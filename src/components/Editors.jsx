import { useId, useState } from 'react';
import { SECTIONS, blankItem } from '../lib/model.js';

export function Field({ label, value, onChange, type = 'text', placeholder, hint, disabled, wide }) {
  const id = useId();
  return (
    <div className={`field${wide ? ' field-wide' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {type === 'textarea' ? (
        <textarea id={id} value={value} placeholder={placeholder} rows={4}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type={type} value={value} placeholder={placeholder} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function BulletsEditor({ label, value, onChange, placeholder }) {
  const set = (i, text) => onChange(value.map((b, n) => (n === i ? text : b)));
  const remove = (i) => onChange(value.length > 1 ? value.filter((_, n) => n !== i) : ['']);
  return (
    <fieldset className="field field-wide bullets">
      <legend>{label}</legend>
      <p className="hint">Start each point with an action verb and include a result or number where you can.</p>
      {value.map((b, i) => (
        <div className="bullet-row" key={i}>
          <textarea rows={2} value={b} aria-label={`Point ${i + 1}`}
            placeholder={i === 0 ? placeholder : ''} onChange={(e) => set(i, e.target.value)} />
          <button type="button" className="icon-btn" onClick={() => remove(i)} aria-label={`Remove point ${i + 1}`}>✕</button>
        </div>
      ))}
      <button type="button" className="link-btn" onClick={() => onChange([...value, ''])}>+ Add a point</button>
    </fieldset>
  );
}

function ItemFields({ section, item, onChange }) {
  const set = (key, v) => onChange({ ...item, [key]: v });
  return (
    <div className="grid">
      {SECTIONS[section].fields.map((f) => {
        if (f.type === 'bullets') {
          return <BulletsEditor key={f.key} label={f.label} value={item[f.key]} placeholder={f.placeholder}
            onChange={(v) => set(f.key, v)} />;
        }
        if (f.type === 'checkbox') {
          return (
            <label key={f.key} className="check field-wide">
              <input type="checkbox" checked={item[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
              {f.label}
            </label>
          );
        }
        return <Field key={f.key} label={f.label} type={f.type} value={item[f.key]} placeholder={f.placeholder}
          wide={f.type === 'textarea'} disabled={f.disabledBy && item[f.disabledBy]}
          onChange={(v) => set(f.key, v)} />;
      })}
    </div>
  );
}

export function ListEditor({ section, items, onChange }) {
  const def = SECTIONS[section];
  const [open, setOpen] = useState(items[0]?.id ?? null);

  const add = () => {
    const item = blankItem(section);
    onChange([...items, item]);
    setOpen(item.id);
  };
  const update = (item) => onChange(items.map((i) => (i.id === item.id ? item : i)));
  const remove = (id) => onChange(items.filter((i) => i.id !== id));
  const move = (index, dir) => {
    const next = [...items];
    const [it] = next.splice(index, 1);
    next.splice(index + dir, 0, it);
    onChange(next);
  };

  const primary = def.fields[0].key;
  const secondary = def.fields[1].key;

  return (
    <div className="list-editor">
      {items.length === 0 && <p className="empty">Nothing here yet. Add your first {def.itemLabel} to get started.</p>}
      {items.map((item, index) => {
        const isOpen = open === item.id;
        return (
          <div className={`item${isOpen ? ' open' : ''}`} key={item.id}>
            <div className="item-head">
              <button type="button" className="item-toggle" aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : item.id)}>
                <span className="item-name">{item[primary] || `New ${def.itemLabel}`}</span>
                {item[secondary] && <span className="item-sub">{item[secondary]}</span>}
              </button>
              <div className="item-actions">
                <button type="button" className="icon-btn" disabled={index === 0}
                  onClick={() => move(index, -1)} aria-label="Move up">↑</button>
                <button type="button" className="icon-btn" disabled={index === items.length - 1}
                  onClick={() => move(index, 1)} aria-label="Move down">↓</button>
                <button type="button" className="icon-btn danger" onClick={() => remove(item.id)}
                  aria-label={`Delete ${item[primary] || def.itemLabel}`}>✕</button>
              </div>
            </div>
            {isOpen && <ItemFields section={section} item={item} onChange={update} />}
          </div>
        );
      })}
      <button type="button" className="secondary" onClick={add}>+ Add {def.itemLabel}</button>
    </div>
  );
}

export function TagEditor({ label, value, onChange, placeholder, suggestions = [] }) {
  const id = useId();
  const [text, setText] = useState('');
  const addTags = (raw) => {
    const incoming = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const lower = value.map((v) => v.toLowerCase());
    const fresh = incoming.filter((s) => !lower.includes(s.toLowerCase()));
    if (fresh.length) onChange([...value, ...fresh]);
    setText('');
  };
  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div className="field field-wide">
      <label htmlFor={id}>{label}</label>
      <div className="tag-input">
        <input id={id} value={text} placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTags(text); }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }} />
        <button type="button" className="secondary" onClick={() => addTags(text)}>Add</button>
      </div>
      <p className="hint">Press Enter after each one, or paste a comma-separated list.</p>
      {value.length > 0 && (
        <ul className="tags">
          {value.map((t) => (
            <li key={t}>
              {t}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Remove ${t}`}>✕</button>
            </li>
          ))}
        </ul>
      )}
      {unused.length > 0 && (
        <div className="suggest">
          <p className="hint">Suggestions</p>
          <ul className="tags ghost">
            {unused.map((s) => (
              <li key={s}><button type="button" onClick={() => onChange([...value, s])}>+ {s}</button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
