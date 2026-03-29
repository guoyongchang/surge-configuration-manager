import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import RulesPage from "@/pages/Rules";
import {
  mockRuleSets,
  mockRules,
  mockRuleSet,
  mockRule,
} from "../../test/fixtures/rules";

const mockInvoke = vi.mocked(invoke);

function renderPage() {
  return render(
    <MemoryRouter>
      <RulesPage />
    </MemoryRouter>
  );
}

// Initial load: 4 concurrent calls in Promise.all
function mockInitialLoad(
  ruleSets = mockRuleSets,
  rules = mockRules,
  subscriptions: unknown[] = [],
  disabledKeys: string[] = []
) {
  mockInvoke
    .mockResolvedValueOnce(ruleSets)
    .mockResolvedValueOnce(rules)
    .mockResolvedValueOnce(subscriptions)
    .mockResolvedValueOnce(disabledKeys);
}

describe("RulesPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Initial Load", () => {
    it("renders remote rule sets and individual rules", async () => {
      mockInitialLoad();
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("China Direct")).toBeInTheDocument();
        expect(screen.getByText("example.com")).toBeInTheDocument();
      });
    });

    it("shows empty state text when no rules exist", async () => {
      mockInitialLoad([], []);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("page.emptyRuleSets")).toBeInTheDocument();
        expect(screen.getByText("page.emptyIndividual")).toBeInTheDocument();
      });
    });
  });

  describe("Add Remote Rule Set", () => {
    it("calls add_remote_rule_set with correct params", async () => {
      const user = userEvent.setup();
      mockInitialLoad([], []);
      // Mock getAllNodeNames (called when dialog opens) then add result then reload
      mockInvoke
        .mockResolvedValueOnce([]) // getAllNodeNames in dialog
        .mockResolvedValueOnce(mockRuleSet) // add_remote_rule_set result
        .mockResolvedValueOnce([mockRuleSet]) // reload: get_remote_rule_sets
        .mockResolvedValueOnce([]) // reload: get_individual_rules
        .mockResolvedValueOnce([]) // reload: get_subscriptions
        .mockResolvedValueOnce([]); // reload: get_disabled_sub_rule_keys

      renderPage();
      await waitFor(() => {
        expect(screen.getByText("addRuleSet.trigger")).toBeInTheDocument();
      });

      await user.click(screen.getByText("addRuleSet.trigger"));
      await waitFor(() => {
        expect(screen.getByText("addRuleSet.title")).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText("addRuleSet.namePlaceholder"), "China Direct");
      await user.type(screen.getByPlaceholderText("addRuleSet.urlPlaceholder"), "https://cdn.example.com/china.list");
      await user.click(screen.getByRole("button", { name: "actions.add" }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("add_remote_rule_set", {
          name: "China Direct",
          url: "https://cdn.example.com/china.list",
          policy: "Proxies",
          updateInterval: 86400,
        });
      });
    });
  });

  describe("Add Individual Rule", () => {
    it("calls add_individual_rule with correct params", async () => {
      const user = userEvent.setup();
      mockInitialLoad([], []);
      mockInvoke
        .mockResolvedValueOnce([]) // getAllNodeNames in dialog
        .mockResolvedValueOnce(mockRule) // add_individual_rule result
        .mockResolvedValueOnce([]) // reload: get_remote_rule_sets
        .mockResolvedValueOnce([mockRule]) // reload: get_individual_rules
        .mockResolvedValueOnce([]) // reload: get_subscriptions
        .mockResolvedValueOnce([]); // reload: get_disabled_sub_rule_keys

      renderPage();
      await waitFor(() => {
        expect(screen.getByText("addRule.trigger")).toBeInTheDocument();
      });

      await user.click(screen.getByText("addRule.trigger"));
      await waitFor(() => {
        expect(screen.getByText("addRule.title")).toBeInTheDocument();
      });

      // Default rule type is DOMAIN, placeholder is "example.com"
      await user.type(screen.getByPlaceholderText("example.com"), "test.com");
      await user.click(screen.getByRole("button", { name: "actions.add" }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("add_individual_rule", {
          ruleType: "DOMAIN",
          value: "test.com",
          policy: "DIRECT",
          comment: null,
        });
      });
    });
  });

  describe("Remove Rule Set", () => {
    it("shows confirm dialog before removing", async () => {
      const user = userEvent.setup();
      mockInitialLoad();
      renderPage();
      await waitFor(() => screen.getByText("China Direct"));

      // Find the delete button (Trash2 icon button) within the first rule set card
      const ruleSetCard = screen.getByText("China Direct").closest("div[class*='card']");
      const deleteBtn = ruleSetCard?.querySelector('button[data-variant="ghost"]');

      if (deleteBtn) {
        await user.click(deleteBtn);
      }

      await waitFor(() => {
        expect(screen.getByText("page.removeRuleSetTitle")).toBeInTheDocument();
      });
    });
  });

  describe("Toggle Rule Enabled State", () => {
    it("calls toggle_individual_rule when switch is clicked", async () => {
      const user = userEvent.setup();
      mockInitialLoad([], mockRules);
      mockInvoke.mockResolvedValueOnce(undefined); // toggle_individual_rule

      renderPage();
      await waitFor(() => screen.getByText("example.com"));

      const switches = screen.getAllByRole("switch");
      await user.click(switches[0]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("toggle_individual_rule", {
          id: "rule-1",
        });
      });
    });
  });
});
