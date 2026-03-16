```aura width=800 height=200
<div style={{
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  background: 'linear-gradient(135deg, #1e1e2e 0%, #181825 100%)',
  borderRadius: '16px',
  border: '1px solid #313244',
  gap: '12px',
}}>
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  }}>
    <div style={{
      display: 'flex',
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #89b4fa, #cba6f7)',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '28px',
    }}>
      👾
    </div>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    }}>
      <span style={{
        fontSize: '36px',
        fontWeight: '700',
        color: '#cdd6f4',
        letterSpacing: '-0.5px',
      }}>
        ilyamiro
      </span>
      <span style={{
        fontSize: '15px',
        color: '#89b4fa',
        fontWeight: '500',
        letterSpacing: '0.5px',
      }}>
        NixOS enjoyer · open source
      </span>
    </div>
  </div>
  <div style={{
    display: 'flex',
    gap: '10px',
    marginTop: '4px',
  }}>
    {['nix', 'python', 'rust', 'linux'].map((tag) => (
      <div key={tag} style={{
        display: 'flex',
        padding: '3px 12px',
        borderRadius: '999px',
        background: '#313244',
        border: '1px solid #45475a',
        color: '#bac2de',
        fontSize: '12px',
        fontWeight: '600',
        letterSpacing: '0.3px',
      }}>
        {tag}
      </div>
    ))}
  </div>
</div>
```

```aura width=800 height=150
<div style={{
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: '100%',
  background: '#1e1e2e',
  borderRadius: '16px',
  border: '1px solid #313244',
  padding: '0 32px',
  gap: '0',
}}>
  {[
    { icon: '📧', label: 'Email', value: 'ilyamiro.work@gmail.com', color: '#a6e3a1' },
    { icon: '✈️', label: 'Telegram', value: '@sacrificeit', color: '#89b4fa' },
    { icon: '🎮', label: 'Discord', value: 'ilyamiro', color: '#cba6f7' },
    { icon: '▶️', label: 'YouTube', value: '@stewart.github', color: '#f38ba8' },
  ].map((item, i) => (
    <div key={i} style={{
      display: 'flex',
      flex: '1',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      borderRight: i < 3 ? '1px solid #313244' : 'none',
      padding: '0 8px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ fontSize: '18px' }}>{item.icon}</span>
        <span style={{ fontSize: '13px', color: '#6c7086', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          {item.label}
        </span>
      </div>
      <span style={{
        fontSize: '13px',
        color: item.color,
        fontWeight: '500',
      }}>
        {item.value}
      </span>
    </div>
  ))}
</div>
```

[![GitHub Stats](https://ghstats.dev/api/card?username=ilyamiro&theme=catppuccin&hide=trend%2Cavg%2Cactive_day%2Cgrade%2Ccontributions%2Crepos%2Cfollowers&custom_title=Stats&border_radius=10)](https://github.com/ilyamiro)

```aura width=800 height=80
<div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  background: '#1e1e2e',
  borderRadius: '16px',
  border: '1px solid #313244',
  gap: '16px',
}}>
  <div style={{
    display: 'flex',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#a6e3a1',
    boxShadow: '0 0 8px #a6e3a1',
  }} />
  <span style={{
    fontSize: '16px',
    color: '#bac2de',
    fontWeight: '500',
    letterSpacing: '0.3px',
  }}>
    thanks for stopping by 👍
  </span>
  <div style={{
    display: 'flex',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#a6e3a1',
    boxShadow: '0 0 8px #a6e3a1',
  }} />
</div>
```
