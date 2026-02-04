// Desregistrar service workers antiguos
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister())
    console.log('Service workers desregistrados')
  })
}
