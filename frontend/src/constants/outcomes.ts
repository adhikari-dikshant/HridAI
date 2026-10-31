import type { ArtworkName } from '@/components/art';
import type { Label } from '@/api/types';
import { Palette } from '@/constants/theme';

type OutcomeStyle = {
  /** Status text and tag colour. Amber, not red, for "needs check-up": calm, not alarming. */
  color: string;
  soft: string;
  /** Outcome card background and hairline border. */
  gradient: string;
  border: string;
  badgeIcon: ArtworkName;
  sealIcon: ArtworkName;
  listIcon: ArtworkName;
  ribbons: ArtworkName;
};

export const Outcomes: Record<Label, OutcomeStyle> = {
  normal: {
    color: Palette.ok,
    soft: Palette.okSoft,
    gradient: 'linear-gradient(131deg, rgb(234, 246, 238) 0%, rgb(211, 235, 221) 71.429%)',
    border: 'rgba(40, 125, 96, 0.12)',
    badgeIcon: 'icon-check-ok-badge',
    sealIcon: 'icon-check-ok-seal',
    listIcon: 'icon-check-ok-list',
    ribbons: 'sound-ribbons-ok',
  },
  needs_checkup: {
    color: Palette.warn,
    soft: Palette.warnSoft,
    gradient: 'linear-gradient(134.68deg, rgb(252, 242, 221) 0%, rgb(244, 224, 180) 71.429%)',
    border: 'rgba(138, 80, 20, 0.12)',
    badgeIcon: 'icon-alert-warn',
    sealIcon: 'icon-alert-warn-seal',
    listIcon: 'icon-alert-warn-list',
    ribbons: 'sound-ribbons-warn',
  },
  unclear: {
    color: Palette.neutral,
    soft: Palette.neutralSoft,
    gradient: 'linear-gradient(134.68deg, rgb(240, 238, 244) 0%, rgb(224, 219, 232) 71.429%)',
    border: 'rgba(112, 106, 123, 0.12)',
    badgeIcon: 'icon-help-badge',
    sealIcon: 'icon-help-seal',
    listIcon: 'icon-help-list',
    ribbons: 'sound-ribbons-neutral',
  },
};
