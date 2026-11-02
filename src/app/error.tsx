"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="standalone-page"><h1>Chưa thể tải nội dung.</h1><p>Kết nối có thể đang gián đoạn. Vui lòng thử lại sau một lúc.</p><Button onClick={reset}>Thử lại</Button></main>;
}
