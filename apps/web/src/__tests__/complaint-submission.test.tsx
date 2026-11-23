import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubmitComplaintView from '../pages/SubmitComplaintView.js';
import { AuthProvider } from '../contexts/AuthContext.js';
import { LangProvider } from '../contexts/LangContext.js';
import '../lib/i18n.js';

function renderSubmitComplaintView() {
  return render(
    <MemoryRouter initialEntries={['/submit']}>
      <LangProvider>
        <AuthProvider>
          <SubmitComplaintView />
        </AuthProvider>
      </LangProvider>
    </MemoryRouter>
  );
}

describe('Complaint Submission Form & Client Validation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders required form inputs and submit button', () => {
    renderSubmitComplaintView();

    expect(screen.getByLabelText(/Complaint Details/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Grievance/i })).toBeInTheDocument();
  });

  it('validates minimum description length and surfaces accessible field error', async () => {
    renderSubmitComplaintView();

    const submitBtn = screen.getByRole('button', { name: /Submit Grievance/i });
    const textarea = screen.getByLabelText(/Complaint Details/i);

    // Enter fewer than 5 characters
    fireEvent.change(textarea, { target: { value: 'Bad' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const errorMsg = screen.getByText(/Complaint description must be at least 5 characters long/i);
      expect(errorMsg).toBeInTheDocument();
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('clears error state when user provides a valid description', async () => {
    renderSubmitComplaintView();

    const submitBtn = screen.getByRole('button', { name: /Submit Grievance/i });
    const textarea = screen.getByLabelText(/Complaint Details/i);

    // Trigger error first
    fireEvent.change(textarea, { target: { value: 'Hi' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });

    // Enter valid description
    fireEvent.change(textarea, {
      target: {
        value: 'Streetlight pole #12 broken near Kala Patthar road junction causing complete blackout at night.',
      },
    });

    await waitFor(() => {
      expect(textarea).toHaveAttribute('aria-invalid', 'false');
    });
  });
});
