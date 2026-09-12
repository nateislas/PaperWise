export type TrustLevel = 'strong' | 'adequate' | 'weak' | 'failing' | 'unclear' | 'unavailable';

export interface TrustLevelConfig {
  label: string;
  shape: 'solid' | 'half' | 'ring' | 'hollow' | 'dashed';
  dot: string;
  text: string;
  wash?: string;
  description: string;
}

export const TRUST: Record<TrustLevel, TrustLevelConfig> = {
  strong: {
    label: 'Strong',
    shape: 'solid',
    dot: 'bg-[--trust-strong]',
    text: 'text-[--trust-strong-text]',
    wash: 'bg-[--trust-strong-wash]',
    description: 'Holds up on this axis',
  },
  adequate: {
    label: 'Adequate',
    shape: 'solid',
    dot: 'bg-[--trust-adequate]',
    text: 'text-[--trust-adequate-text]',
    description: 'Fine, unremarkable',
  },
  weak: {
    label: 'Weak',
    shape: 'half',
    dot: 'bg-[--trust-weak]',
    text: 'text-[--trust-weak-text]',
    wash: 'bg-[--trust-weak-wash]',
    description: 'Real concern, named',
  },
  failing: {
    label: 'Failing',
    shape: 'ring',
    dot: 'bg-[--trust-failing]',
    text: 'text-[--trust-failing-text]',
    wash: 'bg-[--trust-failing-wash]',
    description: "Undermines the paper's claim",
  },
  unclear: {
    label: 'Not stated',
    shape: 'hollow',
    dot: 'bg-transparent',
    text: 'text-[--trust-unclear-text]',
    description: "Paper doesn't give enough to judge",
  },
  unavailable: {
    label: 'Not available',
    shape: 'dashed',
    dot: 'bg-transparent',
    text: 'text-[--trust-unavailable-text]',
    description: "We cannot assess this yet",
  },
};
