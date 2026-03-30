import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, expect, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import CloudSyncPage from "@/pages/CloudSyncPage";

const mockInvoke = vi.mocked(invoke);

const mockCloudSyncSettings = {
  enabled: true,
  github_pat: "ghp_test",
  repo_url: "test/repo",
  auto_sync: false,
  last_synced_at: null,
};

describe("CloudSyncPage", () => {
  afterEach(() => {
    mockInvoke.mockReset();
  });

  it("renders cloud sync page with settings", async () => {
    mockInvoke.mockResolvedValueOnce(mockCloudSyncSettings);
    render(<CloudSyncPage />);
    await waitFor(() => {
      expect(screen.getByText("settings_cloudSync_sectionTitle")).toBeInTheDocument();
    });
  });

  it("shows Sync Now and Restore buttons when enabled", async () => {
    mockInvoke.mockResolvedValueOnce(mockCloudSyncSettings);
    render(<CloudSyncPage />);
    await waitFor(() => {
      expect(screen.getByText("settings_cloudSync_syncNow")).toBeInTheDocument();
      expect(screen.getByText("settings_cloudSync_restoreFromCloud")).toBeInTheDocument();
    });
  });

  it("calls checkSyncConflict before sync — shows conflict dialog on diff", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings) // getCloudSyncSettings initial load
      .mockResolvedValueOnce({
        local_sha: "abc",
        cloud_sha: "def",
        changed_files: [{
          path: "subscriptions/data.json",
          cloud_sha: "sha1",
          local_sha: "sha2",
          cloud_content: '{"test":1}',
          local_content: '{"test":2}',
        }],
      }); // checkSyncConflict

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("check_sync_conflict");
      expect(screen.getByText("settings_cloudSync_conflictTitle")).toBeInTheDocument();
    });
  });

  it("syncs directly when no conflict", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings) // getCloudSyncSettings initial
      .mockResolvedValueOnce(null) // checkSyncConflict → no conflict
      .mockResolvedValueOnce({ is_configured: true, last_synced_at: null, status: "idle" }) // syncToCloud
      .mockResolvedValueOnce(mockCloudSyncSettings); // getCloudSyncSettings refresh

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("sync_to_cloud");
    });
  });

  it("shows restore confirmation before checking conflict", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValueOnce(mockCloudSyncSettings); // initial load

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_restoreFromCloud"));

    await user.click(screen.getByText("settings_cloudSync_restoreFromCloud"));

    await waitFor(() => {
      expect(screen.getByText("settings_cloudSync_restoreConfirmTitle")).toBeInTheDocument();
    });
  });

  it("disables both buttons while syncing", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings) // initial load
      .mockImplementationOnce(() => new Promise((r) => setTimeout(() => r(null), 100))) // checkSyncConflict
      .mockResolvedValueOnce({ is_configured: true, last_synced_at: null, status: "idle" }) // syncToCloud
      .mockResolvedValueOnce(mockCloudSyncSettings); // getCloudSyncSettings

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));

    await waitFor(() => {
      expect(screen.getByText("settings_cloudSync_syncNow")).toBeDisabled();
      expect(screen.getByText("settings_cloudSync_restoreFromCloud")).toBeDisabled();
    });

    // Wait for the async mock to complete to avoid unhandled error
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });
  });

  it("keeps local when Keep Local clicked in conflict", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings) // initial load
      .mockResolvedValueOnce({
        local_sha: "abc",
        cloud_sha: "def",
        changed_files: [{
          path: "subscriptions/data.json",
          cloud_sha: "sha1",
          local_sha: "sha2",
          cloud_content: '{"test":1}',
          local_content: '{"test":2}',
        }],
      }) // checkSyncConflict
      .mockResolvedValueOnce({ is_configured: true, last_synced_at: null, status: "idle" }) // syncToCloud
      .mockResolvedValueOnce(mockCloudSyncSettings); // getCloudSyncSettings after sync

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));
    await waitFor(() => screen.getByText("settings_cloudSync_conflictTitle"));

    await user.click(screen.getByText("settings_cloudSync_keepLocal"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("sync_to_cloud");
    });
  });

  it("keeps cloud when Keep Cloud clicked in conflict", async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce(mockCloudSyncSettings) // initial load
      .mockResolvedValueOnce({
        local_sha: "abc",
        cloud_sha: "def",
        changed_files: [{
          path: "subscriptions/data.json",
          cloud_sha: "sha1",
          local_sha: "sha2",
          cloud_content: '{"test":1}',
          local_content: '{"test":2}',
        }],
      }) // checkSyncConflict
      .mockResolvedValueOnce(undefined) // syncFromCloud (returns void)
      .mockResolvedValueOnce(mockCloudSyncSettings); // getCloudSyncSettings after sync

    render(<CloudSyncPage />);
    await waitFor(() => screen.getByText("settings_cloudSync_syncNow"));

    await user.click(screen.getByText("settings_cloudSync_syncNow"));
    await waitFor(() => screen.getByText("settings_cloudSync_conflictTitle"));

    await user.click(screen.getByText("settings_cloudSync_keepCloud"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("sync_from_cloud");
    });
  });
});
