import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button } from '../button'

expect.extend(toHaveNoViolations)

describe('Button Accessibility', () => {
  it('should have no accessibility violations with text content', async () => {
    const { container } = render(<Button>Click me</Button>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should have no accessibility violations when disabled', async () => {
    const { container } = render(<Button disabled>Disabled Button</Button>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should have no violations with icon-only button when aria-label is provided', async () => {
    const { container } = render(
      <Button size="icon" aria-label="Close dialog">
        <span aria-hidden="true">×</span>
      </Button>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should be keyboard accessible', () => {
    render(<Button>Focusable Button</Button>)
    const button = screen.getByRole('button', { name: 'Focusable Button' })
    expect(button).not.toHaveAttribute('tabindex', '-1')
  })

  it('should have correct role', () => {
    render(<Button>Test Button</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('should support aria-pressed for toggle buttons', async () => {
    const { container } = render(
      <Button aria-pressed="true">Toggle On</Button>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('should have visible focus indicator', () => {
    render(<Button>Focus Test</Button>)
    const button = screen.getByRole('button')
    // Check that focus-visible classes are present in the component's className
    expect(button.className).toContain('focus-visible')
  })
})
