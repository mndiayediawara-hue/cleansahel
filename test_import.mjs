import('./server/db.js').then(m => {
  console.log('loaded ok, db:', typeof m.default)
  process.exit(0)
}).catch(e => {
  console.error('failed:', e.message)
  process.exit(1)
})
