/**
 * WhatsApp Integration Architecture for Gym Business OS
 * Generates direct dispatch links for receipts, renewal reminders, and member welcomes.
 */

export function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`; // Default India country code
  }
  return digits;
}

export function openWhatsApp(phone: string, message: string): void {
  const formattedPhone = cleanPhone(phone);
  const encodedText = encodeURIComponent(message);
  const url = `https://wa.me/${formattedPhone}?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export const WhatsAppTemplates = {
  paymentReceipt(params: {
    gymName: string;
    memberName: string;
    amount: number;
    receiptNumber: string;
    paymentMethod: string;
    planName?: string;
    validUntil?: string;
  }): string {
    return (
      `*Receipt from ${params.gymName}*\n\n` +
      `Dear ${params.memberName},\n` +
      `Thank you for your payment! Here are your receipt details:\n\n` +
      `• *Receipt No:* ${params.receiptNumber}\n` +
      `• *Amount Paid:* ₹${params.amount.toLocaleString('en-IN')}\n` +
      `• *Mode:* ${params.paymentMethod.toUpperCase()}\n` +
      (params.planName ? `• *Package:* ${params.planName}\n` : '') +
      (params.validUntil ? `• *Valid Until:* ${params.validUntil}\n` : '') +
      `\nStay strong & keep crushing your goals! 💪\n` +
      `_${params.gymName} Team_`
    );
  },

  membershipExpiring(params: {
    gymName: string;
    memberName: string;
    planName: string;
    expiryDate: string;
    daysLeft: number;
  }): string {
    return (
      `*Membership Renewal Alert — ${params.gymName}*\n\n` +
      `Hi ${params.memberName},\n` +
      `Your *${params.planName}* membership expires in *${params.daysLeft} day(s)* on *${params.expiryDate}*.\n\n` +
      `Renew today at the front desk to maintain your streak without interruption! 🏋️\n\n` +
      `Best regards,\n` +
      `_${params.gymName}_`
    );
  },

  welcomeMember(params: {
    gymName: string;
    memberName: string;
    memberCode: string;
    branchName: string;
  }): string {
    return (
      `*Welcome to ${params.gymName}!* 🚀\n\n` +
      `Hi ${params.memberName},\n` +
      `We're thrilled to welcome you to our fitness family!\n\n` +
      `• *Member ID:* ${params.memberCode}\n` +
      `• *Home Branch:* ${params.branchName}\n\n` +
      `Please show your Member ID at the front desk when checking in.\n` +
      `Let's make every workout count!\n\n` +
      `_${params.gymName} Team_`
    );
  },
};
