import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import OutputPage from "@/pages/Output";

const mockInvoke = vi.mocked(invoke);

const mockOutputConfig = {
  output_path: "/Users/user/Library/Application Support/com.nssurge.surge-mac/",
  output_filename: "managed.conf",
  auto_regenerate: false,
  minify: false,
  auto_upload: false,
};

const mockBuildRecord = {
  id: "b1",
  filename: "managed.conf",
  description: "",
  time: new Date().toISOString(),
  status: "success" as const,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <OutputPage />
    </MemoryRouter>
  );
}

describe("OutputPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Initial Load", () => {
    it("loads and renders output config", async () => {
      mockInvoke
        .mockResolvedValueOnce(mockOutputConfig) // getOutputConfig
        .mockResolvedValueOnce([]); // getBuildHistory

      renderPage();
      await waitFor(() => {
        expect(screen.getByDisplayValue("managed.conf")).toBeInTheDocument();
      });
    });

    it("shows empty build history when no builds", async () => {
      mockInvoke
        .mockResolvedValueOnce(mockOutputConfig)
        .mockResolvedValueOnce([]);

      renderPage();
      await waitFor(() => {
        expect(screen.getByText("page.noBuilds")).toBeInTheDocument();
      });
    });
  });

  describe("Generate Config", () => {
    it("calls generate_config when generate button is clicked", async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(mockOutputConfig)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockBuildRecord); // generateConfig result

      renderPage();
      await waitFor(() => screen.getByDisplayValue("managed.conf"));

      await user.click(screen.getByText("page.generateBtn"));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("generate_config");
      });
    });

    it("shows generating state while generating", async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(mockOutputConfig)
        .mockResolvedValueOnce([])
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(mockBuildRecord), 100)));

      renderPage();
      await waitFor(() => screen.getByDisplayValue("managed.conf"));

      await user.click(screen.getByText("page.generateBtn"));

      await waitFor(() => {
        expect(screen.getByText("page.generatingBtn")).toBeInTheDocument();
      });
    });
  });

  describe("Preview Config", () => {
    it("calls preview_config when preview button is clicked", async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(mockOutputConfig)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce("[Proxy]\nTest = socks5, 1.2.3.4, 1080"); // previewConfig result

      renderPage();
      await waitFor(() => screen.getByDisplayValue("managed.conf"));

      await user.click(screen.getByText("page.previewBtn"));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("preview_config");
      });
    });
  });

  describe("Output Filename", () => {
    it("calls update_output_config when filename changes", async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce(mockOutputConfig)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(undefined); // updateOutputConfig

      renderPage();
      await waitFor(() => screen.getByDisplayValue("managed.conf"));

      const filenameInput = screen.getByDisplayValue("managed.conf");
      await user.clear(filenameInput);
      await user.type(filenameInput, "custom.conf");
      await filenameInput.blur();

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("update_output_config", {
          config: expect.objectContaining({
            output_filename: "custom.conf",
          }),
        });
      });
    });
  });

  describe("Build History", () => {
    it("displays build history records", async () => {
      const buildWithTime = {
        ...mockBuildRecord,
        time: new Date().toISOString(),
      };
      mockInvoke
        .mockResolvedValueOnce(mockOutputConfig)
        .mockResolvedValueOnce([buildWithTime]);

      renderPage();
      await waitFor(() => {
        expect(screen.getByText("managed.conf")).toBeInTheDocument();
      });
    });

    it("calls clear_build_history when clear button is clicked", async () => {
      const user = userEvent.setup();
      const buildWithTime = {
        ...mockBuildRecord,
        time: new Date().toISOString(),
      };
      mockInvoke
        .mockResolvedValueOnce(mockOutputConfig)
        .mockResolvedValueOnce([buildWithTime])
        .mockResolvedValueOnce(undefined); // clearBuildHistory

      renderPage();
      await waitFor(() => screen.getByText("managed.conf"));

      await user.click(screen.getByText("page.clearAllBtn"));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("clear_build_history");
      });
    });
  });
});
