import BlogSubTabs from "@/components/seo/BlogSubTabs";

// Blog Engine = the three steps of getting a post onto a website: connect the site, write the post,
// upload it. The page header and the main SEO tabs come from app/seo/layout.tsx.
export default function BlogEngineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BlogSubTabs />
      {children}
    </>
  );
}
