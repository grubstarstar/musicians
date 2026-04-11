import { useParams, Navigate } from 'react-router';
import BandProfile from './BandProfile';

export default function BandProfilePage() {
  const { id } = useParams<{ id: string }>();
  const bandId = Number(id);
  if (!bandId) return <Navigate to="/" replace />;
  return <BandProfile bandId={bandId} />;
}
