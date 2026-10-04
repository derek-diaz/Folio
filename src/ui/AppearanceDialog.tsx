import type { ThemeMode } from '../core/theme';
import { AppDialog } from './AppDialog';

const choices: { value: ThemeMode; name: string; description: string }[] = [
  { value: 'dark', name: 'Dark', description: 'Charcoal surfaces and a blue accent' },
  { value: 'light', name: 'Light', description: 'Bright pages and neutral surfaces' },
  { value: 'system', name: 'System', description: 'Follow your device’s appearance' },
];
export function AppearanceDialog({ theme, onTheme, onClose }: { theme: ThemeMode; onTheme: (theme: ThemeMode) => void; onClose: () => void }) {
  return <AppDialog title="Appearance" onClose={onClose}>
    <div className="dialog-body">
      <fieldset className="theme-choices"><legend>Color scheme</legend>
        {choices.map(choice => <label className="theme-choice" key={choice.value}>
          <input type="radio" name="theme" value={choice.value} checked={theme === choice.value} onChange={() => onTheme(choice.value)} />
          <span className={`theme-preview preview-${choice.value}`} aria-hidden="true"><i /><i /><i /></span>
          <span><strong>{choice.name}</strong><small>{choice.description}</small></span>
        </label>)}
      </fieldset>
      <p className="muted preference-note">Changes apply immediately and are remembered on this device.</p>
    </div>
  </AppDialog>;
}
