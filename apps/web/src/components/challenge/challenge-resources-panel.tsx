import {
  challengeResourceKindLabel,
  challengeResourceStatusLabel,
} from '@shenicest/shared'
import { Chip } from '@/components/ui/chip'
import { challengeResourceRows, type ChallengeDetailDto } from '@/lib/challenge-detail'

/** 资源承诺 tab：逐条列出命题方承诺的资源与兑现状态。 */
export function ChallengeResourcesPanel({
  challenge,
}: {
  challenge: ChallengeDetailDto
}) {
  const rows = challengeResourceRows(
    challenge.resources,
    challengeResourceKindLabel,
    challengeResourceStatusLabel,
  )

  return (
    <section className="challenge-panel" aria-labelledby="challenge-resources-title">
      <h2 id="challenge-resources-title" className="challenge-panel__title">
        资源承诺
      </h2>
      <p className="challenge-panel__lead">
        命题方承诺提供的资源与申请条件。状态由主办方逐条维护，公开页只如实展示。
      </p>

      {rows.length ? (
        <div className="challenge-table-wrap">
          <table className="console-table challenge-table">
            <caption className="sr-only">资源承诺清单</caption>
            <thead>
              <tr>
                <th scope="col">类型</th>
                <th scope="col">说明</th>
                <th scope="col">数量</th>
                <th scope="col">申请条件</th>
                <th scope="col">负责人</th>
                <th scope="col">状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.kindLabel}</td>
                  <td className="challenge-table__title">{row.title}</td>
                  <td>{row.quantity}</td>
                  <td>{row.conditions}</td>
                  <td>{row.owner}</td>
                  <td>
                    <Chip tone={row.isUnfulfilled ? 'warning' : 'success'}>
                      {row.statusLabel}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="challenge-panel__empty">这条命题还没有登记资源承诺。</p>
      )}

      <p className="challenge-panel__footnote">未确认的资源不会作为确定权益展示。</p>
    </section>
  )
}
