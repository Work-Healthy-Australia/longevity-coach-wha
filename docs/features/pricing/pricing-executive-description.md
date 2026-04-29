You are an expert full-stack SaaS product architect and senior developer.

I am building a pricing, supplier, and package-builder module for a digital health and longevity coaching app called Janet.

Janet sells B2C and B2B healthspan / longevity memberships. The app has subscription tiers with monthly pricing, annual payment options, annual discounts, inclusions, optional add-ons, and supplier-delivered products/services such as pathology, DEXA scans, personal training, imaging, supplements, GP reviews, coaching sessions, recovery services, and wearable devices.

I need you to design and build the MVP version of a pricing administration feature.

The purpose of this feature is to let an admin:
1. Create and manage suppliers.
2. Add products and services supplied by each supplier.
3. Store wholesale and retail pricing.
4. Store normal contact, account, invoicing, and contract details.
5. Build standard Janet membership tiers.
6. Build custom B2B pricing models for employer clients.
7. Combine Janet services, supplier services, margin rules, discounts, and inclusions into a clear pricing model.
8. Output customer-facing pricing summaries and internal margin views.

Build this as a production-quality module suitable for integration into a Next.js / React app.

Technology assumptions:
- Front end: Next.js with React and TypeScript.
- Styling: Tailwind CSS.
- Components: clean, modern admin SaaS UI.
- Database: PostgreSQL preferred.
- ORM: Prisma.
- Authentication/roles can be stubbed for now but assume admin-only access.
- Stripe integration will come later, so include Stripe-ready fields but do not build full Stripe checkout unless simple placeholders are helpful.

Core entities needed:

1. Supplier
Fields should include:
- supplier_id
- supplier_name
- supplier_type, for example pathology, imaging, fitness, medical, coaching, supplements, recovery, wearable, other
- legal_entity_name
- ABN / tax identifier
- primary_contact_name
- primary_contact_email
- primary_contact_phone
- website
- address
- billing_email
- accounts_contact_name
- accounts_contact_email
- invoice_terms
- payment_terms
- preferred_payment_method
- bank_account_name
- BSB
- account_number
- contract_start_date
- contract_end_date
- contract_status
- notes
- active / inactive status

2. Supplier Product / Service
Fields should include:
- product_service_id
- supplier_id
- name
- category
- type: product, service, test, scan, session, subscription, bundle
- description
- unit_type, for example per test, per scan, per session, per month, per year, per unit, per employee, per patient
- wholesale_cost
- recommended_retail_price
- default_markup_percentage
- GST/tax treatment
- minimum_order_quantity
- lead_time_days
- delivery_method: digital, in-person, shipped, referral, lab, clinic, telehealth
- location_restrictions
- eligibility_notes
- active / inactive
- internal_notes

3. Janet Core Service
Create a separate table/entity for internal Janet services such as:
- Janet AI coach access
- monthly AI check-in
- human health check-in
- health coaching session
- GP review coordination
- corporate dashboard access
- onboarding
- report generation
- employer cohort reporting
- admin support
- care coordination
Fields should include:
- service_id
- name
- description
- internal_cost
- retail_value
- unit_type
- delivery_owner
- active / inactive

4. Membership Tier
Fields should include:
- tier_id
- tier_name
- tier_type: B2C standard, B2B standard, B2B custom
- description
- monthly_price
- annual_price
- annual_discount_percentage
- billing_frequency_options
- minimum_commitment_months
- setup_fee
- currency
- active / inactive
- public_description
- internal_notes

5. Tier Inclusions
The tier needs to support inclusions from both:
- Janet Core Services
- Supplier Products / Services

For each inclusion, store:
- inclusion_id
- tier_id
- inclusion_source: janet_service or supplier_product_service
- referenced_service_id
- quantity_included
- frequency, for example monthly, quarterly, annually, once-off, per employee, per participant
- included_or_discounted
- discount_percentage
- retail_value
- wholesale_cost
- margin
- margin_percentage
- visible_to_customer
- customer_facing_description
- internal_notes

6. B2B Customer / Employer Client
Fields should include:
- client_id
- client_name
- legal_entity_name
- ABN / tax identifier
- industry
- number_of_employees
- expected_participants
- billing_contact_name
- billing_contact_email
- primary_contact_name
- primary_contact_email
- address
- contract_start_date
- contract_end_date
- contract_status
- notes

7. B2B Pricing Model
Allow admin to create a custom pricing model for each employer client.

Fields should include:
- pricing_model_id
- client_id
- model_name
- description
- pricing_basis, for example per employee per month, per active participant per month, flat monthly fee, hybrid, annual contract
- monthly_base_fee
- price_per_employee_per_month
- price_per_participant_per_month
- annual_price
- annual_discount_percentage
- setup_fee
- minimum_participants
- maximum_participants
- included_tier_id, if based on an existing standard tier
- custom_margin_target_percentage
- contract_length_months
- currency
- active / draft / archived
- internal_notes

8. B2B Pricing Model Inclusions
Similar to tier inclusions, but specific to one B2B client pricing model:
- model_inclusion_id
- pricing_model_id
- inclusion_source
- referenced_service_id
- quantity_included
- frequency
- wholesale_cost
- retail_value
- client_price
- margin
- margin_percentage
- pass_through_cost boolean
- visible_to_client
- client_facing_description
- internal_notes

Required screens / UI:

A. Supplier Directory
- Search and filter suppliers.
- Add supplier.
- Edit supplier.
- View supplier details.
- Active/inactive toggle.
- Supplier detail page should show products/services attached to that supplier.

B. Add/Edit Supplier Form
Include all supplier contact, billing, invoicing, contract, payment and notes fields.

C. Supplier Product/Service Catalogue
- Search/filter all products and services.
- Filter by supplier, category, type, delivery method, active/inactive.
- Show wholesale cost, retail price, margin, and status.
- Add/edit product or service.

D. Janet Core Service Catalogue
- Add and manage Janet-owned internal services.
- Track internal cost and retail value.

E. Membership Tier Builder
- Create/edit tier.
- Set monthly price, annual price, annual discount, setup fee and billing options.
- Add inclusions from Janet Core Services and Supplier Products/Services.
- For each inclusion, calculate total wholesale cost, retail value, margin and margin percentage.
- Show a live tier margin summary.
- Show customer-facing inclusion list.
- Show internal cost/margin breakdown.

F. B2B Client Directory
- Add/edit employer clients.
- Track client details, contract dates, number of employees, expected participants.

G. B2B Custom Pricing Builder
This is the most important screen.

It should allow the admin to:
- Select a B2B client.
- Start from scratch or clone an existing standard tier.
- Choose pricing basis:
  - per employee per month
  - per active participant per month
  - flat monthly fee
  - annual contract
  - hybrid
- Add Janet internal services.
- Add supplier products/services.
- Set quantities and frequencies.
- Decide what is included vs discounted vs pass-through cost.
- Override wholesale cost, retail price or client price where needed.
- Set target margin.
- View live calculations:
  - monthly revenue
  - annual revenue
  - total wholesale cost
  - total internal Janet cost
  - gross margin dollars
  - gross margin percentage
  - annual discount impact
  - setup fee
  - estimated profit per participant
- Generate a client-facing pricing summary.
- Generate an internal margin analysis.

H. Pricing Summary / Proposal View
Create a clean printable/exportable pricing summary that includes:
- Client name.
- Pricing model name.
- Billing basis.
- Monthly price.
- Annual price.
- Annual discount.
- Included services.
- Optional add-ons.
- Terms/assumptions.
- Exclusions.
- Notes.

Also create an internal-only version that includes:
- wholesale costs
- supplier costs
- internal costs
- gross margin
- margin percentage
- risk notes
- supplier dependencies

Calculations needed:
- annual_price = monthly_price * 12 * (1 - annual_discount_percentage)
- margin = client_price - wholesale_cost - internal_cost where applicable
- margin_percentage = margin / client_price
- total_tier_wholesale_cost = sum of inclusion wholesale costs based on quantity and frequency
- total_tier_retail_value = sum of retail values
- annualised_cost = cost adjusted for monthly/quarterly/annual/once-off frequency
- gross_margin_percentage = gross_margin / revenue
- allow manual override fields but clearly label them

Important business rules:
- Keep wholesale cost hidden from customer-facing views.
- Allow products/services to be inactive without deleting historical pricing models.
- A B2B pricing model can be created from a standard tier and then customised.
- Supplier services can be included, discounted, optional, or pass-through.
- Annual pricing should show both annual billed upfront and effective monthly equivalent.
- The interface must support both individual memberships and employer/client-level contracts.
- Include GST/tax treatment fields but do not overcomplicate tax logic in MVP.
- Keep all historical pricing models so old proposals can be reviewed later.

Please produce:

1. A clear data model.
2. Prisma schema.
3. Suggested folder/file structure for a Next.js app.
4. React/TypeScript components for the main screens.
5. Tailwind-styled UI.
6. Helper functions for pricing and margin calculations.
7. Seed data examples for:
   - 3 suppliers
   - 8 supplier products/services
   - 6 Janet core services
   - 3 standard membership tiers
   - 2 B2B clients
   - 2 custom B2B pricing models
8. Basic form validation.
9. Clean empty states.
10. Demo data that makes sense for a healthspan/longevity coaching business in Australia.
11. Clearly separate customer-facing fields from internal-only fields.
12. Include comments explaining where Stripe product/price IDs would be stored later.

Design style:
- Modern SaaS admin interface.
- Clean cards, tables, side panels, tabs, and summary cards.
- Use plain English labels.
- Make it easy for a non-technical founder/admin to use.
- Prioritise clarity over visual complexity.
- Use Australian terminology where relevant, including ABN, GST, BSB, account number.

Start by giving me the architecture and data model, then provide the code. Build it in a way that can be copied into an existing Next.js app.