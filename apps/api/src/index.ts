import 'dotenv/config'
import { app } from './app'

app.listen(Number(process.env.PORT) || 3000)

console.log(`Server running at http://localhost:${app.server?.port}`)

export type { App } from './app'
