import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import ExtraNodesPage from "@/pages/ExtraNodes";
import { mockExtraNodes, mockExtraNode } from "../../test/fixtures/nodes";

const mockInvoke = vi.mocked(invoke);

function renderPage() {
  return render(
    <MemoryRouter>
      <ExtraNodesPage />
    </MemoryRouter>
  );
}

describe("ExtraNodesPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Initial Load", () => {
    it("renders node list on load", async () => {
      mockInvoke.mockResolvedValueOnce(mockExtraNodes);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("My SOCKS5 Proxy")).toBeInTheDocument();
      });
    });

    it("shows empty state when no nodes", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("extraNodes_page_empty")).toBeInTheDocument();
      });
    });
  });

  describe("Add Node — Single tab", () => {
    it("calls add_node_from_raw_line with correct params", async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce([]) // initial load
        .mockResolvedValueOnce(mockExtraNode) // add_node_from_raw_line result
        .mockResolvedValueOnce([mockExtraNode]); // getExtraNodes reload

      renderPage();
      await waitFor(() => {
        expect(screen.getByText("extraNodes_dialog_trigger")).toBeInTheDocument();
      });

      // Open the add dialog
      await user.click(screen.getByText("extraNodes_dialog_trigger"));

      // Wait for dialog to open and fill in the form
      await waitFor(() => {
        expect(screen.getByText("extraNodes_dialog_title")).toBeInTheDocument();
      });

      // Fill name
      const nameInput = screen.getByPlaceholderText("e.g. HK-01");
      await user.clear(nameInput);
      await user.type(nameInput, "My Proxy");

      // Fill server
      const serverInput = screen.getByPlaceholderText("1.2.3.4");
      await user.clear(serverInput);
      await user.type(serverInput, "192.168.1.100");

      // Port uses type="number" with default value, no placeholder needed

      // Submit the form
      await user.click(screen.getByText("extraNodes_batch_addBtn"));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          "add_node_from_raw_line",
          expect.objectContaining({
            rawLine: expect.stringContaining("My Proxy"),
            refreshUrl: null,
          })
        );
      });
    });
  });

  describe("Add Node — Batch tab", () => {
    it("switches to batch tab and shows batch form", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce([]);

      renderPage();
      await waitFor(() => {
        expect(screen.getByText("extraNodes_dialog_trigger")).toBeInTheDocument();
      });

      await user.click(screen.getByText("extraNodes_dialog_trigger"));

      await waitFor(() => {
        expect(screen.getByText("extraNodes_dialog_title")).toBeInTheDocument();
      });

      // Switch to batch tab
      await user.click(screen.getByText("extraNodes_tabs_batch"));

      await waitFor(() => {
        expect(screen.getByText("extraNodes_batch_socks5Tab")).toBeInTheDocument();
      });
    });
  });

  describe("Remove Node", () => {
    it("shows confirm dialog and calls remove_extra_node after confirm", async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce([mockExtraNode])
        .mockResolvedValueOnce(undefined); // remove_extra_node

      renderPage();
      await waitFor(() => screen.getByText("My SOCKS5 Proxy"));

      // Find and click the delete button (Trash2 icon)
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg && svg.getAttribute("class")?.includes("lucide-trash2");
      });
      expect(deleteButton).toBeDefined();
      await user.click(deleteButton!);

      // Confirm dialog should appear
      await waitFor(() => {
        expect(screen.getByText("extraNodes_page_removeTitle")).toBeInTheDocument();
      });

      // Click confirm button (destructive)
      const confirmButton = document.querySelector(
        'button[class*="bg-destructive"]'
      ) as HTMLButtonElement;
      expect(confirmButton).toBeInTheDocument();
      await act(async () => {
        await user.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("remove_extra_node", {
          id: "node-1",
        });
      });
    });
  });

  describe("Node Selection", () => {
    it("allows selecting nodes via checkbox", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce([mockExtraNode]);

      renderPage();
      await waitFor(() => screen.getByText("My SOCKS5 Proxy"));

      // Click the card to select it
      await user.click(screen.getByText("My SOCKS5 Proxy"));

      // After selection, the selected count should appear
      await waitFor(() => {
        expect(screen.getByText(/selected/i)).toBeInTheDocument();
      });
    });
  });
});
