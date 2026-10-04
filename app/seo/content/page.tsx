import { redirect } from "next/navigation";

// The Content Engine moved into the Blog Engine.
export default function OldContentEngine() {
  redirect("/seo/blog/content");
}
