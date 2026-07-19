const NeylaBackground = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Warm top-left blob */}
      <div
        className="absolute"
        style={{
          top: '-10%',
          left: '-10%',
          width: '55%',
          height: '55%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 107, 43, 0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      {/* Pink center-right blob */}
      <div
        className="absolute"
        style={{
          top: '5%',
          right: '-5%',
          width: '45%',
          height: '45%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 60, 172, 0.10) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      {/* Purple bottom-left blob */}
      <div
        className="absolute"
        style={{
          bottom: '10%',
          left: '20%',
          width: '40%',
          height: '40%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(120, 75, 160, 0.08) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.6) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
};

export default NeylaBackground;
