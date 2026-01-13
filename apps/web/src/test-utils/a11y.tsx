import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { ReactElement } from 'react'

// Ensure jest-axe matchers are available
expect.extend(toHaveNoViolations)

/**
 * Render a component and run accessibility checks
 *
 * @example
 * it('should have no accessibility violations', async () => {
 *   await checkA11y(<Button>Click me</Button>)
 * })
 */
export async function checkA11y(
  ui: ReactElement,
  options?: RenderOptions
) {
  const { container } = render(ui, options)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
  return results
}

/**
 * Render a component and return both the render result and accessibility results
 *
 * @example
 * it('should render accessibly', async () => {
 *   const { getByRole, a11yResults } = await renderWithA11y(<Button>Click</Button>)
 *   expect(getByRole('button')).toBeInTheDocument()
 *   expect(a11yResults).toHaveNoViolations()
 * })
 */
export async function renderWithA11y(
  ui: ReactElement,
  options?: RenderOptions
): Promise<RenderResult & { a11yResults: Awaited<ReturnType<typeof axe>> }> {
  const renderResult = render(ui, options)
  const a11yResults = await axe(renderResult.container)
  return { ...renderResult, a11yResults }
}

// Re-export for convenience
export { axe, toHaveNoViolations }
