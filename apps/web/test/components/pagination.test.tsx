import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Pagination } from '@/components/pagination'

describe('Pagination', () => {
  it('renders nothing when there is a single page', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} searchParams={{}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders every page when totalPages <= 7', () => {
    render(<Pagination page={3} totalPages={5} searchParams={{}} />)
    for (const label of ['01', '02', '03', '04', '05']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('marks the current page with aria-current="page"', () => {
    render(<Pagination page={2} totalPages={4} searchParams={{}} />)
    const current = screen.getByText('02').closest('a')
    expect(current).toHaveAttribute('aria-current', 'page')
  })

  it('renders PREV as disabled on page 1', () => {
    render(<Pagination page={1} totalPages={4} searchParams={{}} />)
    const prev = screen.getByText(/PREV/)
    expect(prev.tagName).toBe('SPAN')
    expect(prev).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders NEXT as disabled on the last page', () => {
    render(<Pagination page={4} totalPages={4} searchParams={{}} />)
    const next = screen.getByText(/NEXT/)
    expect(next.tagName).toBe('SPAN')
    expect(next).toHaveAttribute('aria-disabled', 'true')
  })

  it('omits page=1 from PREV href but includes it for later pages', () => {
    render(<Pagination page={3} totalPages={4} searchParams={{}} />)
    const prev = screen.getByText(/PREV/).closest('a')!
    // page=3 - 1 = 2 → adds page=2
    expect(prev).toHaveAttribute('href', '/?page=2')
    const next = screen.getByText(/NEXT/).closest('a')!
    expect(next).toHaveAttribute('href', '/?page=4')

    // Page 1 link drops the page param entirely.
    const first = screen.getByText('01').closest('a')!
    expect(first).toHaveAttribute('href', '/')
  })

  it('preserves other search params but drops page from the query when navigating to page 1', () => {
    render(
      <Pagination
        page={3}
        totalPages={5}
        searchParams={{ q: 'ai', category: '开发者工具', page: '3' }}
      />
    )
    const first = screen.getByText('01').closest('a')!
    // page dropped; other params retained
    const href = first.getAttribute('href')!
    expect(href).not.toContain('page=')
    expect(href).toContain('q=ai')
    expect(href).toContain('category=%E5%BC%80%E5%8F%91%E8%80%85%E5%B7%A5%E5%85%B7')
  })

  it('respects a custom basePath', () => {
    render(
      <Pagination
        page={2}
        totalPages={3}
        searchParams={{}}
        basePath="/founder/projects"
      />
    )
    const prev = screen.getByText(/PREV/).closest('a')!
    expect(prev).toHaveAttribute('href', '/founder/projects')
    const next = screen.getByText(/NEXT/).closest('a')!
    expect(next).toHaveAttribute('href', '/founder/projects?page=3')
  })

  it('inserts an ellipsis when there is a gap in the page window', () => {
    render(<Pagination page={5} totalPages={20} searchParams={{}} />)
    // getPageWindow returns [1, 2, 4, 5, 6, 19, 20] with ellipses between
    // 2↔4 and 6↔19.
    const ellipses = screen.getAllByText('…')
    expect(ellipses.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('05')).toBeInTheDocument()
  })

  it('uses the first entry from arrayed search params', () => {
    render(
      <Pagination
        page={2}
        totalPages={3}
        searchParams={{ q: ['first', 'second'] }}
      />
    )
    const next = screen.getByText(/NEXT/).closest('a')!
    expect(next.getAttribute('href')).toContain('q=first')
    expect(next.getAttribute('href')).not.toContain('second')
  })
})
