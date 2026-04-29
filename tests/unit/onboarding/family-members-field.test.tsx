// Wave 2 / addendum #1 — mandatory render-and-emit test for <FamilyMembersField>.

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FamilyMembersField } from "@/app/(app)/onboarding/onboarding-client";
import type { FamilyMemberCard, FieldDef } from "@/lib/questionnaire/schema";

const field: FieldDef = {
  id: "family_members",
  label: "Family members",
  type: "family_members",
  optional: true,
};

function makeCard(overrides: Partial<FamilyMemberCard> = {}): FamilyMemberCard {
  return {
    id: "card-1",
    relationship: "",
    is_alive: true,
    conditions: [],
    ...overrides,
  };
}

describe("<FamilyMembersField>", () => {
  it("renders empty list with the add button", () => {
    const onChange = vi.fn();
    render(<FamilyMembersField field={field} value={[]} onChange={onChange} />);
    expect(screen.getByText("+ Add family member")).toBeInTheDocument();
    expect(screen.queryByText("Relative")).not.toBeInTheDocument();
  });

  it("clicking + Add family member emits onChange with one new card", () => {
    const onChange = vi.fn();
    render(<FamilyMembersField field={field} value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("+ Add family member"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as FamilyMemberCard[];
    expect(next).toHaveLength(1);
    expect(next[0].relationship).toBe("");
    expect(next[0].is_alive).toBe(true);
    expect(next[0].conditions).toEqual([]);
    expect(typeof next[0].id).toBe("string");
  });

  it("changing relationship select emits the updated card", () => {
    const onChange = vi.fn();
    const cards = [makeCard()]; // empty relationship → auto-expanded
    render(
      <FamilyMembersField field={field} value={cards} onChange={onChange} />,
    );
    const select = screen.getByLabelText("Relationship") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "mother" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as FamilyMemberCard[];
    expect(next[0].relationship).toBe("mother");
  });

  it("toggling vital status switch flips is_alive", () => {
    const onChange = vi.fn();
    const cards = [makeCard({ is_alive: true })]; // empty rel → auto-expanded
    render(
      <FamilyMembersField field={field} value={cards} onChange={onChange} />,
    );
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "true");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as FamilyMemberCard[];
    expect(next[0].is_alive).toBe(false);
  });

  it("toggling a condition adds a conditions[] entry", () => {
    const onChange = vi.fn();
    const cards = [makeCard()]; // auto-expanded
    render(
      <FamilyMembersField field={field} value={cards} onChange={onChange} />,
    );
    const cv = screen.getByRole("checkbox", { name: "Heart disease / stroke" });
    expect(cv).toHaveAttribute("aria-checked", "false");
    fireEvent.click(cv);
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as FamilyMemberCard[];
    expect(next[0].conditions).toEqual([{ type: "cardiovascular" }]);
  });

  it("remove button removes the card", () => {
    const onChange = vi.fn();
    const cards = [makeCard({ relationship: "mother" })];
    render(
      <FamilyMembersField field={field} value={cards} onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText("Remove Mother"));
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as FamilyMemberCard[];
    expect(next).toEqual([]);
  });
});
