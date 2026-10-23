import { PLAYER_COLORS } from '../lib/model.ts';
import { imageFromPaste, readClipboardImage, ACCEPT } from '../lib/media.ts';
import { toast } from '../lib/store.ts';
import type { PlayerInput } from '../lib/types.ts';
import { pickFiles } from '../lib/utils.ts';
import { addMediaChecked } from './MediaField.tsx';
import { Avatar } from './MediaView.tsx';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="color-picker">
      {PLAYER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch${c === value ? ' active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Цвет ${c}`}
        />
      ))}
      <label className="swatch custom" title="Свой цвет" style={{ background: PLAYER_COLORS.includes(value) ? undefined : value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />+
      </label>
    </div>
  );
}

/** Имя, цвет и аватар игрока (С1, С2). */
export function PlayerFields({ value, onChange, autoFocus }: { value: PlayerInput; onChange: (p: PlayerInput) => void; autoFocus?: boolean }) {
  const setAvatar = async (file: File | null | undefined) => {
    if (!file) return;
    const meta = await addMediaChecked(file, 'image');
    if (meta) onChange({ ...value, avatar: meta.id });
  };
  return (
    <div
      className="player-fields"
      onPaste={(e) => {
        const file = imageFromPaste(e);
        if (file) {
          e.preventDefault();
          setAvatar(file);
        }
      }}
    >
      <div className="avatar-edit">
        <Avatar id={value.avatar} name={value.name || '?'} color={value.color} size="lg" />
        <div className="avatar-actions">
          <button type="button" className="btn small" onClick={async () => setAvatar((await pickFiles(ACCEPT.image))[0])}>
            Аватар…
          </button>
          <button
            type="button"
            className="btn small ghost"
            title="Вставить картинку из буфера обмена"
            onClick={async () => {
              try {
                const f = await readClipboardImage();
                if (f) setAvatar(f);
                else toast('В буфере обмена нет картинки', 'error');
              } catch {
                toast('Нажмите на поле имени и вставьте картинку Ctrl+V', 'error');
              }
            }}
          >
            Вставить
          </button>
          {value.avatar && (
            <button type="button" className="btn small ghost" onClick={() => onChange({ ...value, avatar: undefined })}>
              Убрать
            </button>
          )}
        </div>
      </div>
      <div className="player-fields-main">
        <input
          className="player-name-input"
          placeholder="Имя игрока"
          value={value.name}
          maxLength={30}
          autoFocus={autoFocus}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        <ColorPicker value={value.color} onChange={(color) => onChange({ ...value, color })} />
      </div>
    </div>
  );
}
