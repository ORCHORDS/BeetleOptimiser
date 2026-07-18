// 7 top tiles (existing Auslogics-style quick-access) + 4 system tools below
// them. Matches Auslogics BoostSpeed dashboard tile arrangement with
// Internet/Disk Explorer/Task Manager/Add-ons Manager added - the rest of
// their tools (Win10 Protectors, Force Uninstall, Browser Protection check)
// are covered by other tabs/right-sidebar nav.

import {
  HardDrives, Trash, RocketLaunch, GlobeHemisphereWest,
  ArrowsClockwise, Copy, PlusCircle, Lightning, FolderOpen,
  Cpu, PuzzlePiece, Eraser, TreeEvergreen, Link, Archive, BellRinging, FileArrowDown,
  Compass, ClockClockwise,
} from '@phosphor-icons/react';

export const TILES_PRIMARY = [
  { id: 'ssd',        Icon: HardDrives,        label: 'SSD Optimizer' },
  { id: 'uninstall',  Icon: Trash,             label: 'Uninstall Manager' },
  { id: 'startup',    Icon: RocketLaunch,      label: 'Startup Manager' },
  { id: 'browser',    Icon: GlobeHemisphereWest, label: 'Browser Protection' },
  { id: 'driver',     Icon: ArrowsClockwise,   label: 'Driver Updater' },
  { id: 'duplicate',  Icon: Copy,              label: 'Duplicates Finder' },
  { id: 'add',        Icon: PlusCircle,        label: 'Add tool' },
];

export const TILES_SYSTEM = [
  { id: 'internet',   Icon: Lightning,         label: 'Internet Speed Up' },
  { id: 'disk-explorer', Icon: FolderOpen,      label: 'Disk Explorer' },
  { id: 'task-manager',  Icon: Cpu,             label: 'Task Manager' },
  { id: 'addons',        Icon: PuzzlePiece,    label: 'Add-ons Manager' },
  { id: 'wiper',         Icon: Eraser,          label: 'Free Space Wiper' },
  { id: 'slimmer',       Icon: TreeEvergreen,   label: 'Windows Slimmer' },
  { id: 'mode',          Icon: Lightning,       label: 'Mode Switcher' },
  { id: 'integrator',    Icon: Link,            label: 'Shell Integrator' },
  { id: 'regdefrag',     Icon: Archive,         label: 'Registry Defrag' },
  { id: 'actioncenter',  Icon: BellRinging,     label: 'Action Center' },
  { id: 'debuglog',      Icon: FileArrowDown,   label: 'Debug Log' },
  { id: 'diskpriority',  Icon: Lightning,       label: 'Disk Priority' },
  { id: 'backupcleaner', Icon: Trash,           label: 'Backup Cleaner' },
  { id: 'defragboot',    Icon: ClockClockwise,  label: 'Defrag on Boot' },
  { id: 'bho',           Icon: Compass,        label: 'Browser BHO' },
];

export const BOTTOM_TILES = [
  ...TILES_PRIMARY.map(t => ({ ...t, line1: t.label.split(' ')[0], line2: t.label.split(' ').slice(1).join(' ') })),
  ...TILES_SYSTEM.map(t => ({ ...t, line1: t.label.split(' ')[0], line2: t.label.split(' ').slice(1).join(' ') })),
];
