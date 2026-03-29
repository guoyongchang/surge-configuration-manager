import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open as pluginDialogOpen } from "@tauri-apps/plugin-dialog";
import SubscriptionsPage from "@/pages/Subscriptions";
import {
  mockSubscriptions,
  mockSubscription,
  mockSubscriptionError,
} from "../../test/fixtures/subscriptions";

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(pluginDialogOpen);

function renderPage() {
  return render(
    <MemoryRouter>
      <SubscriptionsPage />
    </MemoryRouter>
  );
}

describe("SubscriptionsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Initial Load", () => {
    it("renders subscription cards after loading", async () => {
      mockInvoke.mockResolvedValueOnce(mockSubscriptions);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Test Subscription")).toBeInTheDocument();
        expect(screen.getByText("Error Subscription")).toBeInTheDocument();
      });
    });

    it("shows empty state when no subscriptions exist", async () => {
      mockInvoke.mockResolvedValueOnce([]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("page.emptyTitle")).toBeInTheDocument();
      });
    });

    it("shows error badge for subscriptions with error status", async () => {
      mockInvoke.mockResolvedValueOnce([mockSubscriptionError]);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Error")).toBeInTheDocument();
      });
    });
  });

  describe("Add Subscription — URL source", () => {
    it("calls add_subscription with name and url when form is submitted", async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce([]) // get_subscriptions (initial load)
        .mockResolvedValueOnce(mockSubscription) // add_subscription result
        .mockResolvedValueOnce([mockSubscription]); // get_subscriptions (reload after add)

      renderPage();

      // Wait for dialog trigger button to appear
      await waitFor(() => {
        expect(screen.getByText("dialog.triggerLabel")).toBeInTheDocument();
      });

      // Open the add dialog
      await user.click(screen.getByText("dialog.triggerLabel"));

      // Fill in the form
      await user.type(
        screen.getByPlaceholderText("dialog.namePlaceholder"),
        "My Sub"
      );
      await user.type(
        screen.getByPlaceholderText("dialog.urlPlaceholder"),
        "https://example.com/sub.conf"
      );

      // Submit the form — button has text "actions.add" (translation key)
      await user.click(screen.getByRole("button", { name: "actions.add" }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("add_subscription", {
          name: "My Sub",
          url: "https://example.com/sub.conf",
          sourceType: "url",
        });
      });
    });
  });

  describe("Add Subscription — File source", () => {
    it("opens file picker when From File is selected", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce([]);
      mockOpen.mockResolvedValueOnce("/Users/user/config.conf");

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("dialog.triggerLabel")).toBeInTheDocument();
      });

      await user.click(screen.getByText("dialog.triggerLabel"));

      // Switch to file source
      await user.click(screen.getByText("dialog.fromFile"));

      // Click the folder picker button (icon button next to file input)
      const folderButton = screen.getByRole("button", { name: "" });
      await user.click(folderButton);

      await waitFor(() => {
        expect(mockOpen).toHaveBeenCalled();
      });
    });
  });

  describe("Remove Subscription", () => {
    it("shows confirm dialog and calls remove_subscription after confirm", async () => {
      const user = userEvent.setup();
      mockInvoke
        .mockResolvedValueOnce([mockSubscription])
        .mockResolvedValueOnce(undefined) // remove_subscription
        .mockResolvedValueOnce([]); // get_subscriptions after removal

      renderPage();
      await waitFor(() => screen.getByText("Test Subscription"));

      // Open dropdown menu - find button with ellipsis icon
      const moreButtons = screen.getAllByRole("button");
      const moreButton = moreButtons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg && svg.getAttribute("class")?.includes("lucide-ellipsis");
      });
      expect(moreButton).toBeDefined();
      await user.click(moreButton!);

      // Wait for dropdown to appear and click remove
      await waitFor(() => {
        expect(screen.getByText("card.remove")).toBeInTheDocument();
      });
      await user.click(screen.getByText("card.remove"));

      // Confirm dialog should appear — click the destructive confirm button
      await waitFor(() => {
        const confirmButton = document.querySelector(
          'button[class*="bg-destructive"]'
        ) as HTMLButtonElement;
        expect(confirmButton).toBeInTheDocument();
      });
      const confirmButton = document.querySelector(
        'button[class*="bg-destructive"]'
      ) as HTMLButtonElement;
      await act(async () => {
        await user.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("remove_subscription", {
          id: "sub-1",
        });
      });
    });
  });

  describe("Refresh Subscription", () => {
    it("calls refresh_subscription with correct id and updates state", async () => {
      const user = userEvent.setup();
      const refreshedSub = { ...mockSubscription, node_count: 10 };
      mockInvoke
        .mockResolvedValueOnce([mockSubscription])
        .mockResolvedValueOnce(refreshedSub);

      renderPage();
      await waitFor(() => screen.getByText("Test Subscription"));

      // Open dropdown menu
      const moreButtons = screen.getAllByRole("button");
      const moreButton = moreButtons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg && svg.getAttribute("class")?.includes("lucide-ellipsis");
      });
      expect(moreButton).toBeDefined();
      await user.click(moreButton!);

      // Wait for dropdown and click refresh
      await waitFor(() => {
        expect(screen.getByText("card.refreshNow")).toBeInTheDocument();
      });
      await user.click(screen.getByText("card.refreshNow"));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("refresh_subscription", {
          id: "sub-1",
        });
      });
    });
  });

  describe("Set Primary Subscription", () => {
    it("calls setPrimarySubscription with correct id", async () => {
      const user = userEvent.setup();
      const nonPrimarySub = { ...mockSubscription, is_primary: false };
      mockInvoke
        .mockResolvedValueOnce([nonPrimarySub])
        .mockResolvedValueOnce(undefined); // setPrimarySubscription

      renderPage();
      await waitFor(() => screen.getByText("Test Subscription"));

      // Open dropdown menu
      const moreButtons = screen.getAllByRole("button");
      const moreButton = moreButtons.find((btn) => {
        const svg = btn.querySelector("svg");
        return svg && svg.getAttribute("class")?.includes("lucide-ellipsis");
      });
      expect(moreButton).toBeDefined();
      await user.click(moreButton!);

      // Wait for dropdown and click "Set as Primary"
      await waitFor(() => {
        expect(screen.getByText("card.setPrimary")).toBeInTheDocument();
      });
      await user.click(screen.getByText("card.setPrimary"));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("set_primary_subscription", {
          id: "sub-1",
        });
      });
    });
  });

  describe("Empty state interaction", () => {
    it("opens add dialog when clicking empty state area", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValueOnce([]);

      renderPage();
      await waitFor(() => screen.getByText("page.emptyTitle"));

      await user.click(screen.getByText("page.emptyTitle"));

      await waitFor(() => {
        expect(screen.getByText("dialog.addTitle")).toBeInTheDocument();
      });
    });
  });
});
