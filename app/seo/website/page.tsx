import { redirect } from "next/navigation";

// "Connect to Website" became Blog Engine → Connection 2 Web.
export default function OldConnectToWebsite() {
  redirect("/seo/blog/connection");
}
