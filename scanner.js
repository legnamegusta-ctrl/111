async function scanTag() {
  if ('NDEFReader' in window) {
    try {
      const reader = new NDEFReader();
      await reader.scan();
      return new Promise(resolve => {
        reader.onreading = e => resolve(e.serialNumber || '');
      });
    } catch (err) {
      console.error(err);
    }
  } else if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scan = () => {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            detector.detect(canvas).then(codes => {
              if (codes.length) {
                stream.getTracks().forEach(t => t.stop());
                resolve(codes[0].rawValue);
              } else {
                requestAnimationFrame(scan);
              }
            }).catch(reject);
          } else {
            requestAnimationFrame(scan);
          }
        };
        scan();
      });
    } catch (err) {
      console.error(err);
    }
  } else {
    alert('Leitor RFID/QR não suportado neste navegador.');
  }
}
window.scanTag = scanTag;
