import { DocumentoLegal } from '@/components/legal/DocumentoLegal';
import { t } from '@/i18n/es-UY';

export default function PantallaTerminos() {
  return <DocumentoLegal documento={t.legal.terminos} />;
}
