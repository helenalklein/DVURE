-- Revises the real DVURE contract text (0097) now that the schema can
-- actually back several of its tags: {{project_type}} (campaigns.type,
-- 0017), {{shoot_dates}}/{{shoot_location}} (0099), {{brand_address}}
-- (0098), and a real sender identity for the signature block
-- ({{sender_name}}/{{sender_title}}/{{sent_date}} — resolveContractMergeTags,
-- contracts.ts). Also:
--  - Services/Role and Call Time become static text (same treatment as
--    the existing "Rate Basis: Day Rate" / "DVURE Payment Processing"
--    precedent) — this platform only ever books modeling talent, and
--    per the user's own call, call time isn't tracked anywhere and
--    isn't worth adding a field for, so both are real values instead of
--    permanently-blank fill-ins.
--  - 3.2 Overtime and 3.3 Additional Services are now wrapped in
--    data-optional-section markers — stripOptionalSections (contracts.ts)
--    removes either block entirely unless the project's
--    overtime_included/additional_services_included flag (0099) is on.
--    Previously both sections were hardcoded into every contract with
--    no way to exclude them.
--  - The Brand signature block drops the "By: ___" line — redundant
--    once Name is a real auto-filled value rather than another blank
--    the same person would just fill in twice. Name/Title/Date become
--    real tags instead of blanks.
--  - The Model signature Date and DVURE RECORD's Executed Date/Status
--    deliberately stay exactly as they are (not converted to tags) —
--    none of the three is knowable at the moment this document is
--    generated and frozen (signing/execution happen later), and 0097
--    already established the precedent of never hardcoding a status
--    that's false at generation time. Those three facts are surfaced
--    live, next to the frozen document, in ModelApp.tsx/BrandApp.tsx
--    instead — see this same session's plan.
--
-- Scoped to rows that still match 0097's own output verbatim, so this
-- can never overwrite a brand's own edits to their copy.
update contract_templates
set content_html = '<h1 style="text-align:center;letter-spacing:0.02em;">MODEL BOOKING &amp; USAGE AGREEMENT</h1>
<p>This Model Booking &amp; Usage Agreement (&ldquo;<strong>Agreement</strong>&rdquo;) is entered into as of the date of the last signature below by and between:</p>
<p><strong>CLIENT / BRAND:</strong></p>
<p>Legal Name: {{brand_name}}<br>Business Name (if different): {{brand_business_name}}<br>Address: {{brand_address}}<br>Email: {{brand_email}}</p>
<p>and</p>
<p><strong>MODEL:</strong></p>
<p>Legal Name: {{model_name}}<br>Professional Name (if different): {{model_professional_name}}<br>Address: {{model_address}}<br>Email: {{model_email}}</p>
<p>Client and Model may each be referred to as a &ldquo;Party&rdquo; and collectively as the &ldquo;Parties.&rdquo;</p>
<p>This Agreement governs the Model&rsquo;s services and the Client&rsquo;s authorized use of the Model&rsquo;s name, image, likeness, and performance in connection with the Project identified below.</p>

<h2>1. Project</h2>
<p>Project Name: {{project_name}}<br>Project Type: {{project_type}}<br>Client / Brand: {{brand_name}}<br>Services / Role: Talent<br>Shoot / Performance Date(s): {{shoot_dates}}<br>Call Time: TBD<br>Estimated End Time: {{end_time}}<br>Location: {{shoot_location}}<br>Photographer / Production Company: {{production_company}}<br>Other Relevant Personnel: {{other_personnel}}</p>

<h2>2. Model Services</h2>
<p>Model agrees to provide modeling, appearance, performance, fitting, rehearsal, or related services reasonably described in the Project Details.</p>
<p>Model agrees to arrive at the specified location at the agreed call time and to perform the agreed services in a professional manner.</p>
<p>Any material change to the nature, duration, location, or requirements of the engagement must be agreed to by the Parties in writing, including electronically through DVURE.</p>

<h2>3. Compensation</h2>
<h3>3.1 Booking Fee</h3>
<p>Client shall pay Model:</p>
<p>Base Fee: {{day_rate}}<br>Rate Basis: Day Rate</p>
<p>The Base Fee covers the services expressly described in this Agreement and the usage rights expressly granted below.</p>
<div data-optional-section="overtime">
<h3>3.2 Overtime</h3>
<p>The agreed rate for services covers {{overtime_included_hours}} hours.</p>
<p>Additional time requested by Client beyond the agreed service period shall be compensated at an Overtime Rate of {{overtime_rate}} per hour.</p>
<p>Overtime shall be calculated in {{overtime_increment}}-minute increments.</p>
</div>
<div data-optional-section="additional_services">
<h3>3.3 Additional Services</h3>
<p>Additional shoot days, fittings, rehearsals, travel days, or other services shall require separate compensation as agreed by the Parties.</p>
</div>

<h2>4. Usage Rights</h2>
<p>In consideration of the compensation stated in this Agreement, Model grants Client the limited right to use photographs, video, recordings, or other materials created in connection with the Project (&ldquo;<strong>Materials</strong>&rdquo;) that depict Model, solely within the following agreed scope.</p>
<h3>4.1 Permitted Media</h3>
<p><em>Delete any lines below that do not apply to this engagement before sending.</em></p>
<ul>
<li>Website / E-Commerce</li>
<li>Organic Social Media</li>
<li>Paid Social / Digital Advertising</li>
<li>Digital Advertising</li>
<li>Print Advertising</li>
<li>Editorial / Press</li>
<li>Retail / Point-of-Sale</li>
<li>Packaging</li>
<li>Outdoor Advertising / Billboard</li>
<li>In-Store Display</li>
<li>Other: {{other_media_description}}</li>
</ul>
<h3>4.2 Territory</h3>
<p>{{territory}}</p>
<h3>4.3 Usage Term</h3>
<p>Usage rights begin on {{usage_start_date}} and continue through {{usage_end_date}}.</p>
<p>Usage Term: {{duration}}.</p>
<p>Unless otherwise expressly stated, Client may not make new uses of the Materials after expiration of the Usage Term.</p>
<h3>4.4 Usage Fee</h3>
<p>The Usage Fee described in this Section is included within the Base Fee stated in Section 3.1. If additional usage is requested after execution of this Agreement, the Parties must agree to the additional media, territory, duration, and compensation in writing.</p>

<h2>5. Exclusivity</h2>
<p><em>Keep whichever line below applies and delete the other before sending.</em></p>
<p>No exclusivity applies.</p>
<p>Limited exclusivity applies as follows: Competitor / Category: {{exclusivity_category}}; Territory: {{exclusivity_territory}}; Duration: {{exclusivity_duration}}.</p>
<p>Model shall not be restricted from working with other clients except to the extent expressly stated in this Section.</p>

<h2>6. Client Responsibilities</h2>
<p>Client shall provide Model with reasonable information necessary to perform the engagement, including applicable call times, locations, wardrobe requirements, production requirements, and material changes to the Project.</p>
<p>Client shall provide any agreed wardrobe, hair, makeup, equipment, facilities, transportation, accommodations, or other production services identified in the Project Details.</p>
<p>Client shall not require Model to perform services materially outside the agreed scope without Model&rsquo;s consent.</p>

<h2>7. Wardrobe, Appearance &amp; Content</h2>
<p>The agreed wardrobe, styling, hair, makeup, and appearance requirements are: {{wardrobe_description}}</p>
<p>Any substantially different requirement must be disclosed to and approved by Model before the service is performed.</p>
<p>Client shall not require Model to participate in nudity, simulated sexual activity, sexually explicit content, or materially different intimate content unless specifically and separately agreed to in writing before the engagement.</p>
<p>Model may decline any request that materially exceeds the agreed scope of the engagement.</p>

<h2>8. Safety &amp; Professional Conduct</h2>
<p>The Parties agree to maintain a professional and reasonably safe working environment.</p>
<p>Model may decline to perform an activity that Model reasonably believes presents an unsafe or materially undisclosed risk.</p>
<p>Client shall not engage in harassment, discrimination, sexual harassment, threats, coercion, or abusive conduct toward Model.</p>
<p>Any material safety or conduct issue may result in suspension or termination of the engagement.</p>

<h2>9. Cancellation &amp; Rescheduling</h2>
<h3>9.1 Client Cancellation</h3>
<p>If Client cancels the engagement:</p>
<ul>
<li>More than 72 hours before call time: No cancellation fee is owed unless otherwise specified.</li>
<li>24&ndash;72 hours before call time: Client shall pay 50% of the Base Fee.</li>
<li>Less than 24 hours before call time or after Model has arrived: Client shall pay 100% of the Base Fee.</li>
</ul>
<h3>9.2 Model Cancellation</h3>
<p>If Model cancels without reasonable cause, Model shall promptly notify Client and cooperate in good faith regarding rescheduling where reasonably possible.</p>
<p>Nothing in this Section requires Model to perform services where doing so would reasonably create a safety concern, violate applicable law, or materially exceed the agreed scope.</p>
<h3>9.3 Rescheduling</h3>
<p>A mutually agreed rescheduled engagement shall replace the original date without additional cancellation fees unless otherwise agreed.</p>

<h2>10. Travel &amp; Expenses</h2>
<p>Client shall be responsible for the following approved expenses <em>(delete any lines below that do not apply)</em>:</p>
<ul>
<li>Transportation</li>
<li>Airfare</li>
<li>Hotel</li>
<li>Meals / Per Diem</li>
<li>Ground Transportation</li>
<li>Other: {{other_expense_description}}</li>
</ul>
<p>Expense Terms: {{expense_terms}}</p>
<p>No material travel expense shall be incurred on behalf of either Party without prior agreement.</p>

<h2>11. Payment</h2>
<p>Client shall pay Model the amounts due under this Agreement through DVURE Payment Processing.</p>
<p>Payment Due: {{payment_due_days}} days after completion of services.</p>
<p>If payment is processed through DVURE or a third-party payment provider, applicable processing fees may apply as separately disclosed.</p>
<p>Any dispute concerning payment shall not affect undisputed amounts owed.</p>

<h2>12. Model&rsquo;s Representations</h2>
<p>Model represents that:</p>
<ol>
<li>Model has authority to enter into this Agreement.</li>
<li>Model will provide accurate information concerning Model&rsquo;s identity and availability.</li>
<li>Model is not knowingly violating another contractual obligation by accepting this engagement.</li>
<li>Model will notify Client of any material conflict that would prevent Model from performing the agreed services.</li>
</ol>

<h2>13. Client&rsquo;s Representations</h2>
<p>Client represents that:</p>
<ol>
<li>Client has authority to enter into this Agreement.</li>
<li>Client has the right to commission and use the Project Materials within the scope agreed herein.</li>
<li>Client will comply with applicable laws and regulations relating to the production and use of the Materials.</li>
<li>Client will not use Model&rsquo;s likeness outside the agreed usage rights without obtaining additional authorization and, where applicable, additional compensation.</li>
</ol>

<h2>14. AI &amp; Digital Alteration</h2>
<p>Client shall not use Model&rsquo;s image, likeness, voice, or performance to create a materially new synthetic representation of Model, including an AI-generated or digitally manipulated likeness, except as expressly authorized in writing by Model.</p>
<p>Routine technical editing, including color correction, cropping, retouching, resizing, and similar post-production reasonably customary for the agreed Project, is permitted.</p>
<p>Any use of Model&rsquo;s likeness for AI training, creation of a digital replica, synthetic performance, virtual influencer, or substantially altered identity requires separate written authorization.</p>

<h2>15. Portfolio Use</h2>
<p>Unless otherwise stated below, Model may display final Materials depicting Model in Model&rsquo;s professional portfolio, website, social media, comp card, or similar self-promotional materials after the Client has publicly released the Materials.</p>
<p>Portfolio Use Restriction: {{portfolio_restriction}}</p>

<h2>16. Ownership of Materials</h2>
<p>Except for the rights expressly granted to Client under this Agreement, this Agreement does not transfer ownership of any intellectual property.</p>
<p>The Parties acknowledge that ownership of photographs, video, recordings, trademarks, and other Project materials may belong to the applicable creator or rights holder.</p>
<p>This Agreement governs Client&rsquo;s authorized use of Model&rsquo;s name, likeness, image, and performance and does not itself transfer copyright ownership in the underlying Materials unless expressly stated in writing.</p>

<h2>17. Independent Contractor</h2>
<p>Model is engaged as an independent contractor and not as an employee of Client.</p>
<p>Nothing in this Agreement creates a partnership, joint venture, employment relationship, or agency relationship between the Parties.</p>
<p>Model is responsible for Model&rsquo;s own taxes and other obligations applicable to independent contractor compensation, except to the extent applicable law provides otherwise.</p>

<h2>18. Confidentiality</h2>
<p>The Parties shall keep confidential non-public business, financial, creative, production, and personal information received in connection with the Project, except where disclosure is required by law or reasonably necessary to perform the engagement.</p>
<p>This Section does not restrict information that is publicly available through no breach of this Agreement.</p>

<h2>19. Termination</h2>
<p>Either Party may terminate this Agreement if the other Party materially breaches its obligations and fails to cure the breach when reasonably capable of cure.</p>
<p>Nothing in this Agreement limits any rights either Party may have under applicable law.</p>
<p>Termination does not eliminate payment obligations already accrued or rights that, by their nature, are intended to survive termination.</p>

<h2>20. Electronic Signatures</h2>
<p>The Parties agree that electronic signatures and electronic acceptance of this Agreement shall have the same effect as original signatures to the extent permitted by applicable law.</p>
<p>Each Party shall receive or have access to a copy of the fully executed Agreement.</p>

<h2>21. Entire Agreement</h2>
<p>This Agreement, together with the Project Details and any written attachments or amendments expressly incorporated into it, constitutes the entire agreement between the Parties concerning the engagement.</p>
<p>Any amendment must be agreed to in writing, including electronically through DVURE.</p>

<h2>22. Governing Law</h2>
<p>This Agreement shall be governed by the laws of the State of Arizona, without regard to its conflict-of-law principles, unless the Parties expressly select another jurisdiction in the Project Details.</p>
<p>Any dispute shall be resolved in a court of competent jurisdiction in {{governing_county}}, Arizona, unless otherwise required by applicable law.</p>

<h2>Signatures</h2>
<p>By signing below, each Party acknowledges that they have read, understood, and voluntarily agreed to the terms of this Agreement.</p>

<p style="margin-top:16px;"><strong>CLIENT / BRAND</strong></p>
<p>Legal Name: {{brand_name}}<br><br>Name: {{sender_name}}<br><br>Title: {{sender_title}}<br><br>Date: {{sent_date}}</p>

<p style="margin-top:16px;"><strong>MODEL</strong></p>
<p>Legal Name: {{model_name}}<br>Professional Name: {{model_professional_name}}<br><br>Signature: ____________________________________<br><br>Date: ________________________________________</p>

<p style="margin-top:16px;"><strong>DVURE RECORD</strong></p>
<p>Project ID: {{project_id}}<br>Agreement ID: {{contract_number}}<br>Executed Date: {{executed_date}}<br>Status: {{contract_status}}</p>

<p style="text-align:center;font-size:11px;color:var(--muted-foreground);margin-top:24px;">DVURE INC. IS NOT A PARTY TO THIS AGREEMENT.</p>
',
    updated_at = now()
where source = 'dvure_default'
  and content_html like '%DVURE INC. IS NOT A PARTY%'
  and content_html like '%Services / Role: {{services_description}}%';
