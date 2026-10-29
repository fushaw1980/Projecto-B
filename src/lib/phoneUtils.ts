/**
 * Mozbiscates Mozambique Phone & WhatsApp Utility
 * Valida, normaliza e gera links de contacto direto do WhatsApp
 */

export function cleanPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw).replace(/\D/g, '');
}

/**
 * Valida se é um número móvel válido de Moçambique (Vodacom: 84/85, Tmcel: 82/83, Movitel: 86/87)
 */
export function isValidMozPhone(raw: string | null | undefined): boolean {
  const digits = cleanPhone(raw);
  if (!digits) return false;

  // Formato local com 9 dígitos (ex: 841234567)
  if (digits.length === 9) {
    const prefix = digits.slice(0, 2);
    return ['82', '83', '84', '85', '86', '87'].includes(prefix);
  }

  // Formato internacional com 258 (ex: 258841234567)
  if (digits.length === 12 && digits.startsWith('258')) {
    const prefix = digits.slice(3, 5);
    return ['82', '83', '84', '85', '86', '87'].includes(prefix);
  }

  // Permite outros formatos de teste se tiverem pelo menos 8 dígitos
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Normaliza para número com indicativo internacional 258 (ex: 258841234567)
 */
export function normalizeMozPhone(raw: string | null | undefined): string {
  const digits = cleanPhone(raw);
  if (!digits) return '';
  if (digits.startsWith('258')) {
    return digits;
  }
  return `258${digits}`;
}

/**
 * Formata visualmente para exibição limpa (ex: +258 84 123 4567)
 */
export function formatDisplayPhone(raw: string | null | undefined): string {
  const digits = cleanPhone(raw);
  if (!digits) return 'Sem WhatsApp';

  let local = digits;
  if (local.startsWith('258')) {
    local = local.slice(3);
  }

  if (local.length === 9) {
    return `+258 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  }

  return `+258 ${local}`;
}

/**
 * Gera URL direto para conversa no WhatsApp com texto predefinido
 */
export function getWhatsAppUrl(rawPhone: string | null | undefined, message?: string): string {
  const normalized = normalizeMozPhone(rawPhone);
  if (!normalized) return '#';
  const encodedText = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${normalized}${encodedText}`;
}
