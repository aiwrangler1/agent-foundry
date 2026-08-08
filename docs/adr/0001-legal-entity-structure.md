# ADR 0001: parent corporation with ring-fenced operating subsidiaries

Status: proposed for attorney and tax-advisor review

## Decision

Use a US parent Delaware C corporation, internally named Agent Foundry, Inc.
The parent owns the platform IP, control-plane code, shared contracts, and
central governance. Each material digital business unit should be launched in
a separately capitalized wholly owned operating subsidiary, initially a
single-member LLC owned by the parent and taxed according to advice from the
company's tax advisor. Do not form subsidiaries merely to create paperwork:
create one when a business unit has material external liability, contracts,
employees/contractors, regulated activity, distinct financing, or a distinct
sale/transfer scenario.

The parent remains the contracting and governance home for shared platform
services. Subsidiaries receive services under written intercompany agreements,
maintain separate books and bank relationships where required, and never share
credentials, approval authority, or unallocated funds merely because they are
under common ownership.

## Rationale

The parent C-corp gives a durable share-based ownership and financing structure
for a company that may raise capital, issue equity, hire, or acquire/sell
business units. Subsidiary LLCs provide a flexible ring-fence for operating
risk without forcing every early experiment into a new corporation. This is an
operating recommendation, not legal or tax advice.

## Alternatives rejected for now

- One LLC for everything: simpler, but it mixes platform IP, shared services,
  and business-unit liabilities.
- A corporation for every business unit: stronger separation, but unnecessary
  cost and governance before a unit has material risk or financing needs.
- S corporation: not selected because ownership, equity, and financing
  constraints may conflict with the planned parent-company trajectory.

## Required human review before formation

Counsel and a tax advisor must confirm state of registration/foreign
qualification, founder equity and IP assignment, tax elections, beneficial
ownership reporting, employment and contractor structure, insurance, privacy
and consumer obligations, and the intercompany services/licensing model.

The control plane records this as a proposed legal structure only; it does not
form an entity or provide legal advice.
