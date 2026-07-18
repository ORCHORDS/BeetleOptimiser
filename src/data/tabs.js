// Top tab labels and icons in exact Auslogics order.
// Store and All Tools were removed per user spec - the user said
// "no need store or all tools tabs or even on side menues".
import {
  House, MagnifyingGlass, Briefcase, Trash, GearSix, ShieldCheck, Calendar,
  Clock, ClipboardText, Shield, Lifebuoy, Question,
} from '@phosphor-icons/react';

export const TABS = [
  { id: 'Dashboard',       label: 'Dashboard',       Icon: House },
  { id: 'Scanner',         label: 'Scanner',         Icon: MagnifyingGlass },
  { id: 'Advisor',         label: 'Advisor',         Icon: Briefcase },
  { id: 'Clean Up',        label: 'Clean Up',        Icon: Trash },
  { id: 'Optimize',        label: 'Optimize',        Icon: GearSix },
  { id: 'Protect',         label: 'Protect',         Icon: ShieldCheck },
  { id: 'Maintain',        label: 'Maintain',        Icon: Calendar },
  { id: 'My Tasks',        label: 'My Tasks',        Icon: Clock },
  { id: 'Reports',         label: 'Reports',         Icon: ClipboardText },
  { id: 'Win10 Protector', label: 'Win10 Protector', Icon: Shield },
  { id: 'Care Center',     label: 'Care Center',     Icon: Lifebuoy },
  { id: 'Ask a Question',  label: 'Ask a Question',  Icon: Question },
];
