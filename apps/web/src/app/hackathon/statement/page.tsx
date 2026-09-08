import Image from 'next/image'
import Link from 'next/link'

export const metadata = { title: '致歉与声明 | 黑客松专区' }

export default function HackathonStatementPage() {
  return (
    <main className="statement-shell mx-auto w-full max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
      <Link className="detail-back" href="/hackathon">&lt; 返回黑客松项目</Link>
      <p className="eyebrow mt-10">HACKATHON / STATEMENT</p>
      <h1 className="statement-title">She Nicest 团队关于「烈变千人黑客松」活动的致歉与声明</h1>
      <div className="hackathon-letter-stack mt-10">
        {[1, 2, 3].map((page) => (
          <Image
            key={page}
            src={`/letter-${page}.png`}
            alt={`致歉与声明手写信第 ${page} 页`}
            width={4493}
            height={6358}
          />
        ))}
      </div>
    </main>
  )
}
