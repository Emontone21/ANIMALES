import { DocumentoLegal } from '@/components/legal/DocumentoLegal';
import { t } from '@/i18n/es-UY';

export default function PantallaPrivacidad() {
  return <DocumentoLegal documento={t.legal.privacidad} />;
}
