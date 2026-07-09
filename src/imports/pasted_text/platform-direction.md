Platform Direction Update

Talent Submissions Naming

Keep “Talent Submissions” as the primary navigation item. This best reflects the workflow:

Brand creates campaign → Agencies submit talent → Brand reviews talent submissions → Talent is shortlisted → Talent is booked.

Although agencies perform the submission, the core object being reviewed is the talent.

Negotiation Workflow

Add negotiation support to the booking process.

Recommended workflow:

Brand publishes campaign with proposed day rate or project rate.
Agency submits talent.
Agency can Accept Rate, Counter Offer, or Decline.
Brand receives counteroffer notification.
Brand can Accept, Counter, or Reject.
Once terms are accepted, booking status changes to Confirmed and contract generation becomes available.

Suggested booking statuses:

Submitted
Under Review
Shortlisted
Counter Offered
Negotiating
Rate Approved
Booked
Contract Pending
Contract Executed

Future Payments Architecture

Design all payment screens so they can evolve into a marketplace payout system.

Long-term flow:

Brand → CasFlow → Agency and/or Model

V1 should display:

Gross Booking Value
Agency Commission
Platform Fee
Net Talent Earnings
Payment Status

Future functionality should support:

Direct model payouts
Wallet balances
Accelerated payouts
Debit card integration
Earnings history

Product Development Roadmap

Current priority is completing all three operating systems:

Brand OS
Agency OS
Model OS

Before engineering begins, define:

User permissions
Database entities
Payment flows
Booking lifecycle
Contract lifecycle

The goal of Figma is to fully document workflows, screens, permissions, and interactions so engineers can later build the product without ambiguity.

Long-Term Vision

CasFlow should be positioned as the workflow and payments infrastructure for the talent industry.

The platform may eventually support:

Marketplace payouts
Wallets
Faster payments
Debit cards
Financial products for talent

These should be designed for future expansion but not required for V1 launch.

Payments System Update

Domestic Payments (V1)

The platform should support direct payment distribution through the platform.

Payment Flow:

Brand → Platform → Agency + Model

Once a booking is completed, approved, and invoiced, the platform processes payment and automatically allocates funds according to the executed booking agreement.

The platform should calculate and display:

* Gross Booking Value
* Agency Commission
* Platform Fee
* Net Model Earnings
* Total Payout Amount

Example:

Booking Value: $5,000

Agency Commission: $1,000
Platform Fee: $150
Model Earnings: $3,850

The platform automatically distributes funds according to the booking agreement.

Payment Allocation Engine

Add a Payment Allocation Engine to every booking.

The system should support:

* Fixed agency commissions
* Percentage-based agency commissions
* Fixed platform fees
* Percentage-based platform fees
* Model payout calculations
* Multiple payout recipients (future)

Payment Statuses

* Awaiting Completion
* Awaiting Invoice
* Invoice Submitted
* Invoice Approved
* Payment Scheduled
* Payment Processing
* Payment Completed
* Payment Failed

Payment Dashboard Metrics

* Outstanding Payments
* Pending Approval
* Processing Payments
* Completed Payments
* Total Booking Volume
* Total Agency Commissions
* Total Platform Revenue
* Total Model Earnings

Booking Financial Summary

Every booking should include a dedicated financial section displaying:

Booking Value
Agency Commission
Platform Fee
Net Model Earnings
Payment Status
Settlement Date

Negotiation Workflow

Add structured rate negotiation.

Brand publishes campaign with proposed compensation.

Agencies can:

* Accept Rate
* Submit Counteroffer
* Decline Opportunity

Brands can:

* Accept Counteroffer
* Submit Revised Offer
* Reject Counteroffer

Booking statuses:

* Submitted
* Under Review
* Shortlisted
* Counter Offered
* Negotiating
* Rate Approved
* Booked
* Contract Pending
* Contract Executed

Future Financial Infrastructure

Design all payment architecture so future versions can support:

* International payments
* Marketplace payouts
* Multi-currency support
* Talent wallets
* Accelerated payouts
* Debit cards
* Credit products
* Earnings verification
* Financial products for talent

Do not build these features yet.

However, all payment, booking, contract, and earnings screens should be designed with future expansion in mind.

Long-Term Vision

The platform should evolve into the operating system and financial infrastructure for the talent industry.

The initial focus remains:

Campaigns → Talent Submissions → Bookings → Contracts → Payments

All future financial products should build on top of this workflow rather than replace it.

Platform Vision:

This platform is not primarily a talent discovery marketplace. It is workflow infrastructure for the modeling industry. The platform exists to connect brands, agencies, and models through a unified operating system that manages campaigns, submissions, bookings, contracts, communication, notifications, payments, and reporting.

The goal is to eliminate fragmented workflows currently spread across email, spreadsheets, phone calls, PDFs, text messages, and separate financial systems.

Core Users:

Brands

Create campaigns
Review agency submissions
Select talent
Manage bookings
Send contracts
Process payments
Track campaign progress

Agencies

Receive campaign opportunities
Submit talent
Manage bookings
Coordinate communication
Sign contracts
Track payments and invoices

Models

Receive booking updates
Access contracts
Receive notifications
Track payments
Manage availability and profile information

Default Platform Settings:

Default Country: United States
Default Currency: USD
Default Date Format: MM/DD/YYYY
Default Payment Assumptions: United States
International expansion supported in future releases

New Feature: Campaign Broadcast Preferences

Add a dedicated Agency Settings page called Campaign Broadcast Preferences.

Agencies can choose:

Receive All Campaigns
Receive Campaigns Matching My Specialties
Receive Campaigns From Followed Brands Only

Specialty Filters:

Fashion
Beauty
Commercial
E-commerce
Runway
Luxury
Fitness
Lifestyle
Editorial
Influencer

Location Filters:

United States
Canada
Europe
United Kingdom
Asia-Pacific
Custom Regions

Brand Follow System:

Agencies can follow specific brands and receive instant notifications whenever those brands post new campaigns.

New Feature: Activity Feed

Add a platform-wide Activity Feed that acts as the operational timeline for every campaign and booking.

Example Feed Events:

Campaign Created
Campaign Updated
New Agency Submission
Talent Shortlisted
Talent Selected
Booking Confirmed
Contract Sent
Contract Signed
Shoot Details Updated
Invoice Generated
Payment Requested
Payment Received
Payment Released
Booking Completed

Each activity item should be clickable and take the user directly to the associated booking, contract, campaign, invoice, or payment record.

New Feature: Notification Center

Add a dedicated Notification Center.

Example Notifications:

New campaign available
New submission received
Talent selected
Contract awaiting signature
Contract signed
Shoot information updated
Payment received
Payment released
New message
Booking completed

Notifications should support:

In-app notifications
Email notifications
User preference controls

New Feature: Booking Workspace

Each booking should function as a dedicated workspace.

The booking workspace contains:

Booking Details
Talent List
Shoot Information
Contracts
Activity Feed
Messages
Payments
Documents

All parties involved in the booking access the same workspace, creating a single source of truth.

New Feature: Communication Hub

Replace fragmented email communication with structured booking communication.

Features:

Booking-specific messaging
Broadcast updates to all participants
Agency-to-brand communication
Automated status notifications
Centralized communication history

The platform should feel less like a social network and more like a mission-control system for managing work.

Design Philosophy:

The platform should feel:

Professional
Premium
Operational
Reliable
Efficient

It should resemble enterprise workflow software rather than a social media platform.

Primary Value Proposition:

Brands should save time.

Agencies should receive more opportunities and reduce administrative work.

Models should gain visibility into bookings, contracts, and payments.

Every feature should support the core mission:

Become the operating system for the modeling industry.                                                                        Also, add a “archived” tab to show previous or archived shoots on the dashboard that have already been completed. Make it the tab after drafts on the dashboard.         And it wouldn’t be toggle from “brand” to “agency” brands and agencies would have fundamentally different logins, so only focus on gearing it towards Brands. This website is a Brand OS only for the time being, but the functionality must show that it will work with agencies still. Put a little notification number or bubble next to each “booking updates” “bookings” and “submissions” tab so we know how many are unread. Change the symbol next to “booking updates” to something a bit more update driven and less squiggly.             Product Direction Update

Important Architectural Change:

Remove the Brand / Agency toggle.

The platform should not function as a single interface with different views. Instead, it should function as three distinct operating systems sharing the same underlying infrastructure.

Brand OS
Agency OS
Model Portal

Each user type has fundamentally different workflows and should have a dedicated experience optimized for their responsibilities.

Current design work should focus exclusively on Brand OS.

Brand OS Navigation

Update navigation to:

Dashboard
Campaigns
Submissions
Bookings
Contracts
Payments
Activity
Agencies

The goal is to communicate that the platform manages the complete workflow from campaign creation through payment.

Dashboard Updates

Add a new Campaign Status tab:

Active
Drafts
Archived

Archived campaigns should remain accessible for historical reporting, repeat bookings, payment records, and campaign reference.

Activity Feed

Add a dedicated Activity Feed section to the dashboard and a standalone Activity page.

Activity items should be chronological, clickable, and linked to the relevant campaign, booking, contract, invoice, or payment.

Example Activity Events:

Campaign Created
AW25 Womenswear Campaign created.

Campaign Updated
Budget updated from $15,000 to $18,000.

Campaign Published
Campaign released to eligible agencies.

Campaign Closed
Submission deadline reached.

Submission Received
Elite Models submitted 3 models.

Submission Updated
Additional portfolio materials received.

Talent Shortlisted
Zara Okafor added to shortlist.

Talent Selected
Zara Okafor selected for booking.

Booking Created
Booking generated from campaign selection.

Booking Confirmed
All parties confirmed booking.

Shoot Details Updated
Location information updated.

Call Sheet Published
Call sheet distributed.

Booking Completed
Shoot completed successfully.

Contract Generated
Contract created from booking.

Contract Sent
Contract delivered for signature.

Contract Signed
Agency signed contract.

Contract Fully Executed
All required signatures received.

Invoice Submitted
Elite Models submitted invoice.

Invoice Approved
Invoice approved for payment.

Payment Initiated
ACH payment initiated.

Payment Completed
Agency payment completed.

Payout Released
Model payout released.

Payout Completed
Funds delivered successfully.

Notification Center

Add a notification center accessible from all pages.

Example notifications:

New campaign available
New submission received
Talent selected
Contract awaiting signature
Contract signed
Invoice submitted
Payment initiated
Payment completed
Payout released
New message
Booking completed

Allow users to manage notification preferences.

Campaign Broadcast Preferences

Agency Settings should include Campaign Broadcast Preferences.

Options:

Receive All Campaigns
Receive Campaigns Matching My Specialties
Receive Campaigns From Followed Brands Only

Specialty Filters:

Fashion
Beauty
Commercial
E-commerce
Runway
Luxury
Editorial
Fitness
Lifestyle
Influencer

Location Filters:

United States
Canada
Europe
United Kingdom
Asia-Pacific
Custom Regions

Brand Follow System:

Agencies can follow specific brands and receive notifications when those brands publish campaigns.

Payments (Domestic V1)

Payments should be a first-class workflow and navigation item.

The platform should support domestic payment processing as part of the booking lifecycle.

Payment Statuses:

Awaiting Invoice
Invoice Submitted
Approved
Payment Requested
Processing
Paid
Released

Payment Dashboard Cards:

Outstanding Payments
Pending Approval
Processing
Completed This Month

Booking Payment View Example:

Booking Value: $15,000
Agency Fee: $3,000
Platform Fee: $450
Model Earnings: $11,550

Status: Processing
Payment Method: ACH
Expected Settlement Date

Use enterprise payment language throughout the platform:

Preferred Terms:

Initiate Payment
Process Payout
Release Payment
Payment Processing
Settlement Date

Avoid consumer-focused language such as:

Send Money
Transfer Cash
Pay Talent

Booking Workspace

Each booking should become a dedicated workspace.

Booking Workspace Sections:

Overview
Talent
Shoot Details
Contracts
Messages
Activity
Payments
Documents

The booking workspace should serve as the single source of truth for all participants involved in a booking.

Platform Philosophy

The platform is not a casting marketplace.

The platform is workflow infrastructure for the modeling industry.

Its purpose is to replace fragmented workflows currently spread across email, spreadsheets, PDFs, text messages, phone calls, invoicing systems, and payment systems.

The product should feel closer to Salesforce, HubSpot, or an EMR than a social media platform.

The objective is to become the operating system for brands, agencies, and models.