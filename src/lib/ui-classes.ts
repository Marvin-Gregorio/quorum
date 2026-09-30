export const PRIMARY_BTN =
  'inline-block bg-seal text-paper border-2 border-seal rounded-[3px] px-5 py-[11px] text-sm font-semibold ' +
  'cursor-pointer no-underline whitespace-nowrap hover:bg-seal-dark hover:border-seal-dark ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-seal disabled:hover:border-seal';

export const SECONDARY_BTN =
  'bg-transparent border border-ink rounded-[3px] px-5 py-[11px] text-sm cursor-pointer text-ink';

export const SIGNIN_BTN =
  'inline-block border border-ink bg-transparent rounded-[3px] px-4 py-2 text-sm cursor-pointer text-ink no-underline';

export const TEXT_INPUT =
  'w-full px-[13px] py-[11px] border border-line-strong rounded-[3px] bg-paper text-[15px] text-ink';

export const FIELD_LABEL = 'block text-[13px] text-ink-2 mb-1.5';

export const MODAL_OVERLAY = 'fixed inset-0 bg-[rgba(28,43,58,0.45)] flex items-center justify-center p-6 z-20';
export const MODAL_PANEL = 'w-full max-w-[440px] bg-paper border border-line rounded-[4px] p-8';
export const MODAL_PANEL_WIDE = 'max-w-[520px] max-h-[88vh] overflow-y-auto';

export const BREADCRUMB_LIST = 'list-none flex gap-2 m-0 p-0 text-[13px] text-ink-2';
export const BREADCRUMB_LINK = 'text-ink-2 no-underline';

export const STATUS_BADGE_BASE =
  'text-xs font-medium px-[13px] py-1 rounded-full border border-transparent whitespace-nowrap inline-block';

export type ElectionStatus = 'open' | 'closed' | 'scheduled' | 'neutral';

export const STATUS_BADGE_VARIANT: Record<ElectionStatus, string> = {
  open: 'bg-[rgba(60,78,97,0.14)] text-ink-2 border-[rgba(60,78,97,0.4)]',
  neutral: 'bg-[rgba(60,78,97,0.14)] text-ink-2 border-[rgba(60,78,97,0.4)]',
  closed: 'bg-[rgba(156,59,46,0.14)] text-seal-dark border-[rgba(156,59,46,0.4)]',
  scheduled: 'bg-[rgba(70,87,59,0.14)] text-ledger border-[rgba(70,87,59,0.4)]',
};

function avatarShape(size: 'sm' | 'md'): string {
  return size === 'sm' ? 'w-9 h-9 rounded-full shrink-0' : 'w-12 h-12 rounded-full shrink-0';
}

export function avatarClass(size: 'sm' | 'md'): string {
  return `${avatarShape(size)} flex items-center justify-center text-paper font-semibold ${size === 'sm' ? 'text-xs' : 'text-[15px]'}`;
}

export function avatarImgClass(size: 'sm' | 'md'): string {
  return `${avatarShape(size)} object-cover`;
}

export const RADIO_CHOICE_CLASS =
  'appearance-none w-[18px] h-[18px] rounded-full border-2 border-ink-2 mt-0.5 shrink-0 cursor-pointer bg-paper ' +
  'checked:border-seal checked:bg-seal checked:shadow-[inset_0_0_0_3.5px_var(--color-paper)]';

export const RADIO_OPTION = 'flex items-start gap-2.5 py-[10px] cursor-pointer';

export const CANDIDATE_ROW = 'flex justify-between items-center py-3.5 border-b border-line first:border-t';

export const CHIP =
  'inline-flex items-center gap-2 px-[10px] py-1.5 border border-line-strong rounded-[3px] bg-paper-2 text-sm';
export const CHIP_REMOVE_BTN = 'bg-transparent border-none text-ink-2 cursor-pointer text-sm leading-none p-0';
