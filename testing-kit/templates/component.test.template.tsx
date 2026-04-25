// React component test template — vitest + @testing-library/react.
// Copy into tests/, rename, swap the imports for the component you want to test.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// import YourComponent from '@/components/YourComponent';

describe('YourComponent', () => {
  it('renders children', () => {
    render(<button>hello</button>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('calls callback on click', () => {
    const onClick = vi.fn();
    render(<button onClick={onClick}>click me</button>);
    fireEvent.click(screen.getByText('click me'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows different content based on props', () => {
    function Demo({ label }: { label: string }) {
      return <p>{label}</p>;
    }
    const { rerender } = render(<Demo label="A" />);
    expect(screen.getByText('A')).toBeInTheDocument();
    rerender(<Demo label="B" />);
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});
