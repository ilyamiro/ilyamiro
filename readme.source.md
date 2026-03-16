```aura width=850 height=450
<div style={{
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  height: '100%',
  backgroundColor: '#1e1e2e',
  fontFamily: 'sans-serif',
  borderRadius: '24px',
  border: '2px solid #313244',
  color: '#cdd6f4'
}}>
  <style>
    {`
      @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
      }
      @keyframes pulse {
        0% { opacity: 0.8; }
        50% { opacity: 1; transform: scale(1.02); }
        100% { opacity: 0.8; }
      }
      #hero-text { animation: float 6s ease-in-out infinite; }
      #nixos-badge { animation: pulse 3s infinite; }
    `}
  </style>

  <div id="hero-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <h1 style={{ fontSize: '64px', fontWeight: '800', margin: '0', color: '#cba6f7', letterSpacing: '-1.5px' }}>
      Hello, I am ilyamiro
    </h1>
    
    <div id="nixos-badge" style={{ 
      marginTop: '24px', 
      display: 'flex', 
      alignItems: 'center', 
      backgroundColor: '#89b4fa', 
      color: '#11111b', 
      padding: '12px 32px', 
      borderRadius: '99px', 
      fontSize: '28px', 
      fontWeight: 'bold',
      boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
    }}>
      I am using NixOS ❄️
    </div>
  </div>

  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '48px' }}>
    <h3 style={{ fontSize: '24px', color: '#a6e3a1', fontWeight: '600', margin: '0 0 20px 0' }}>📫 How to reach me</h3>
    <div style={{ display: 'flex', gap: '20px' }}>
      <div style={{ display: 'flex', backgroundColor: '#313244', padding: '16px 24px', borderRadius: '16px', fontSize: '20px', color: '#f38ba8', borderBottom: '4px solid #f38ba8' }}>
        📧 ilyamiro.work@gmail.com
      </div>
      <div style={{ display: 'flex', backgroundColor: '#313244', padding: '16px 24px', borderRadius: '16px', fontSize: '20px', color: '#74c7ec', borderBottom: '4px solid #74c7ec' }}>
        ✈️ Telegram: @sacrificeit
      </div>
      <div style={{ display: 'flex', backgroundColor: '#313244', padding: '16px 24px', borderRadius: '16px', fontSize: '20px', color: '#b4befe', borderBottom: '4px solid #b4befe' }}>
        👾 Discord: ilyamiro
      </div>
    </div>
  </div>
</div>

```

<div align="center">




<a href="mailto:ilyamiro.work@gmail.com"><b>Email</b></a> •
<a href="https://t.me/sacrificeit"><b>Telegram</b></a> •
<a href="https://www.youtube.com/@stewart.github"><b>YouTube</b></a> •
<a href="https://github.com/ilyamiro/nixos-configuration"><b>NixOS Config</b></a>





</div>

```


