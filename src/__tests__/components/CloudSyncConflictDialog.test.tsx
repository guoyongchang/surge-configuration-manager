import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, expect } from "vitest";
import CloudSyncConflictDialog from "@/components/CloudSyncConflictDialog";

const mockConflict = {
  local_sha: "abc",
  cloud_sha: "def",
  changed_files: [
    {
      path: "subscriptions/data.json",
      cloud_sha: "sha1",
      local_sha: "sha2",
      cloud_content: '{"name":"sub-a"}',
      local_content: '{"name":"sub-b"}',
    },
  ],
};

describe("CloudSyncConflictDialog", () => {
  it("renders conflict title", () => {
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
      />
    );
    expect(screen.getByText("settings_cloudSync_conflictTitle")).toBeInTheDocument();
  });

  it("renders conflict hint", () => {
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
      />
    );
    expect(screen.getByText("settings_cloudSync_conflictHint")).toBeInTheDocument();
  });

  it("displays file path of changed file", () => {
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
      />
    );
    expect(screen.getByText("subscriptions/data.json")).toBeInTheDocument();
  });

  it("formats and displays JSON content for cloud and local", () => {
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
      />
    );
    // Check formatted JSON is displayed
    expect(screen.getByText(/"name":\s*"sub-a"/)).toBeInTheDocument();
    expect(screen.getByText(/"name":\s*"sub-b"/)).toBeInTheDocument();
  });

  it("calls onKeepLocal when Keep Local button is clicked", async () => {
    const user = userEvent.setup();
    const onKeepLocal = vi.fn();
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={onKeepLocal}
        onKeepCloud={vi.fn()}
      />
    );
    await user.click(screen.getByText("settings_cloudSync_keepLocal"));
    expect(onKeepLocal).toHaveBeenCalled();
  });

  it("calls onKeepCloud when Keep Cloud button is clicked", async () => {
    const user = userEvent.setup();
    const onKeepCloud = vi.fn();
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={onKeepCloud}
      />
    );
    await user.click(screen.getByText("settings_cloudSync_keepCloud"));
    expect(onKeepCloud).toHaveBeenCalled();
  });

  it("disables buttons when loading", () => {
    render(
      <CloudSyncConflictDialog
        conflict={mockConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
        loading={true}
      />
    );
    // When loading, buttons show "..." instead of translation keys
    // The footer buttons (Cancel, Keep Cloud, Keep Local) are in a flex container at the end
    // We check the buttons in the footer div (last div before closing DialogContent)
    const footerDiv = document.querySelector("div.flex.justify-end.gap-2");
    expect(footerDiv).toBeInTheDocument();
    const footerButtons = footerDiv!.querySelectorAll("button");
    expect(footerButtons.length).toBe(3);
    footerButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("renders multiple changed files", () => {
    const multiConflict = {
      local_sha: "abc",
      cloud_sha: "def",
      changed_files: [
        {
          path: "subscriptions/data.json",
          cloud_sha: "sha1",
          local_sha: "sha2",
          cloud_content: '{"a":1}',
          local_content: '{"a":2}',
        },
        {
          path: "rules/remote.json",
          cloud_sha: "sha3",
          local_sha: "sha4",
          cloud_content: '{"b":1}',
          local_content: '{"b":2}',
        },
      ],
    };
    render(
      <CloudSyncConflictDialog
        conflict={multiConflict}
        onKeepLocal={vi.fn()}
        onKeepCloud={vi.fn()}
      />
    );
    expect(screen.getByText("subscriptions/data.json")).toBeInTheDocument();
    expect(screen.getByText("rules/remote.json")).toBeInTheDocument();
  });
});
