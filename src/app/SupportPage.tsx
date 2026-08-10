import { DvureSignature } from "./shared/ui";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-4">
        <DvureSignature size={16}/>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-heading text-2xl mb-2">Support</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Need help with your account, a campaign, a booking, or a payment? Reach out and we'll get back to you.
        </p>
        <a href="mailto:support@dvure.com" className="text-sm font-medium text-foreground hover:underline">
          support@dvure.com
        </a>
      </div>
    </div>
  );
}
