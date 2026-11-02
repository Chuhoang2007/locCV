import Link from "next/link";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return <main id="main-content" className="standalone-page"><Brand /><h1>Trang này không còn ở đây.</h1><p>Liên kết có thể đã thay đổi hoặc bạn chưa được cấp quyền xem nội dung.</p><Button asChild><Link href="/">Về trang chủ</Link></Button></main>;
}
