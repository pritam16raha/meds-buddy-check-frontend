import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddMedicationForm } from './AddMedicationForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null, data: [{}] }),
    })),
  },
}));

describe('AddMedicationForm', () => {
  it('renders all form fields correctly', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <AddMedicationForm />
      </QueryClientProvider>
    );

    expect(screen.getByLabelText(/Medication Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Dosage/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Frequency/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Add Medication/i })).toBeInTheDocument();
  });
});