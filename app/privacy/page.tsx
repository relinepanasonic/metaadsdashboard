// Public privacy policy. Google and Meta ask for a privacy-policy address before an app can use their
// sign-in. This page is reachable without logging in (see PUBLIC_PATHS in lib/supabase/middleware.ts).

export const metadata = { title: "Privacy Policy — ProfToko Dashboard" };

const CONTACT = "profesortokoonline@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-12 text-sm leading-relaxed text-slate-300">
      <h1 className="text-2xl font-black text-white">Privacy Policy</h1>
      <p className="mt-1 text-xs text-slate-500">ProfToko Dashboard · digitalads.profesoronline.id · Last updated 21 October 2026</p>

      <h2 className="mt-8 text-base font-bold text-white">Who we are</h2>
      <p className="mt-2">
        ProfToko Dashboard is a private marketing-reporting and scheduling tool operated by Prof Toko Online (profesoronline.id). It is used by our own team and by clients we work with, to see advertising and social-media results and to schedule posts.
      </p>

      <h2 className="mt-8 text-base font-bold text-white">What data we access</h2>
      <p className="mt-2">When an administrator connects an account, the tool reads, only for accounts that person is authorised to manage:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><b>Google Ads:</b> campaign, ad group, keyword, search-term and performance statistics (impressions, clicks, cost, conversions) and account names.</li>
        <li><b>Meta (Facebook, Instagram, Threads):</b> page, post and account performance statistics, and, to publish scheduled posts, the right to post on the connected accounts.</li>
        <li><b>Google Search Console:</b> search-performance data for the websites we manage.</li>
        <li><b>Our own users:</b> an email address and username for each person who logs in to the dashboard.</li>
      </ul>

      <h2 className="mt-8 text-base font-bold text-white">How we use it</h2>
      <p className="mt-2">
        Only to show reports and recommendations to the account owner and the clients they work for, and to publish content the user has scheduled. We do not sell data, we do not share it with advertisers or data brokers, and we do not use it for advertising of our own.
      </p>
      <p className="mt-2">
        The tool&apos;s use of information received from Google APIs adheres to the <a className="text-cyan-300 underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements. Information received from Google APIs is used only to provide and improve the reporting features described here, and is not transferred to others, used for advertising, or read by people except where needed for support or to comply with law.
      </p>

      <h2 className="mt-8 text-base font-bold text-white">Where it is stored and for how long</h2>
      <p className="mt-2">
        Reporting data and login tokens are stored in a managed database (Supabase) and hosted on Vercel. Access tokens for connected accounts are stored encrypted. Data is kept while the account stays connected, and removed when it is disconnected or on request.
      </p>

      <h2 className="mt-8 text-base font-bold text-white">Your choices and deletion</h2>
      <p className="mt-2">
        You can disconnect an account at any time, and you can revoke access from your Google or Meta account settings. To ask us to delete the data we hold about you or your accounts, email <a className="text-cyan-300 underline" href={`mailto:${CONTACT}`}>{CONTACT}</a> and we will do so within 30 days.
      </p>

      <h2 className="mt-8 text-base font-bold text-white">Contact</h2>
      <p className="mt-2">Questions about this policy: <a className="text-cyan-300 underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </main>
  );
}
