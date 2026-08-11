import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterBar } from '@/components/filter-bar'

// Shared mocks per test. useRouter().replace captures the target URL so we can
// assert the URL sync behaviour without mounting a real router.
const replace = vi.fn()
let currentSearch = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace,
    push: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

beforeEach(() => {
  replace.mockClear()
  currentSearch = ''
})

describe('FilterBar — search submit', () => {
  it('sets the q param when the user types and submits', async () => {
    const user = userEvent.setup()
    render(<FilterBar />)

    await user.type(screen.getByPlaceholderText(/搜索项目名称/), '  ai  ')
    await user.click(screen.getByRole('button', { name: '搜索' }))

    expect(replace).toHaveBeenCalledOnce()
    expect(replace).toHaveBeenCalledWith('/?q=ai', { scroll: false })
  })

  it('clears the q param when the user submits an empty query', async () => {
    currentSearch = 'q=ai'
    const user = userEvent.setup()
    render(<FilterBar />)

    const input = screen.getByPlaceholderText(/搜索项目名称/)
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: '搜索' }))

    expect(replace).toHaveBeenCalledWith('/', { scroll: false })
  })

  it('drops the page param on every navigation', async () => {
    currentSearch = 'page=3'
    const user = userEvent.setup()
    render(<FilterBar />)

    await user.type(screen.getByPlaceholderText(/搜索项目名称/), 'ai')
    await user.click(screen.getByRole('button', { name: '搜索' }))

    expect(replace).toHaveBeenCalledWith('/?q=ai', { scroll: false })
  })
})

describe('FilterBar — category chips', () => {
  it('sets the category param on click', async () => {
    const user = userEvent.setup()
    render(<FilterBar />)
    await user.click(screen.getByRole('button', { name: '开发者工具' }))
    expect(replace).toHaveBeenCalledWith(
      '/?category=%E5%BC%80%E5%8F%91%E8%80%85%E5%B7%A5%E5%85%B7',
      { scroll: false }
    )
  })

  it('clears the category param when the active chip is clicked again', async () => {
    currentSearch = 'category=%E5%BC%80%E5%8F%91%E8%80%85%E5%B7%A5%E5%85%B7'
    const user = userEvent.setup()
    render(<FilterBar />)
    await user.click(screen.getByRole('button', { name: '开发者工具' }))
    expect(replace).toHaveBeenCalledWith('/', { scroll: false })
  })

  it('marks the active chip with aria-pressed="true"', () => {
    currentSearch = 'category=%E5%BC%80%E5%8F%91%E8%80%85%E5%B7%A5%E5%85%B7'
    render(<FilterBar />)
    const active = screen.getByRole('button', { name: '开发者工具' })
    expect(active).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('FilterBar — stage chips', () => {
  it('sets the stage param on click', async () => {
    const user = userEvent.setup()
    render(<FilterBar />)
    await user.click(screen.getByRole('button', { name: 'MVP 阶段' }))
    expect(replace).toHaveBeenCalledWith('/?stage=0', { scroll: false })
  })

  it('toggles the stage param off when clicked twice', async () => {
    currentSearch = 'stage=0'
    const user = userEvent.setup()
    render(<FilterBar />)
    await user.click(screen.getByRole('button', { name: 'MVP 阶段' }))
    expect(replace).toHaveBeenCalledWith('/', { scroll: false })
  })
})

describe('FilterBar — sort select', () => {
  it('drops the sort param when latest is selected (default)', async () => {
    currentSearch = 'sort=recently_updated'
    const user = userEvent.setup()
    render(<FilterBar />)
    await user.selectOptions(screen.getByRole('combobox', { name: '排序方式' }), 'latest')
    expect(replace).toHaveBeenCalledWith('/', { scroll: false })
  })

  it('sets sort=recently_updated when selected', async () => {
    const user = userEvent.setup()
    render(<FilterBar />)
    await user.selectOptions(
      screen.getByRole('combobox', { name: '排序方式' }),
      'recently_updated'
    )
    expect(replace).toHaveBeenCalledWith('/?sort=recently_updated', { scroll: false })
  })
})
