import { ArrowLeft, MapPinOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PortalNotFound({ destination, roleLabel }: { destination: string; roleLabel: string }) {
  return <section className="portal-not-found">
    <MapPinOff size={44} aria-hidden="true" />
    <h1>Không tìm thấy trang</h1>
    <p>Đường dẫn này không tồn tại hoặc không còn khả dụng trong portal.</p>
    <Link className="button" to={destination}><ArrowLeft size={18} aria-hidden="true" /> Quay về trang dành cho {roleLabel}</Link>
  </section>;
}
