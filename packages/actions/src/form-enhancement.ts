/**
 * @fileoverview Progressive enhancement for forms with server actions
 */

import type { UseActionResult } from './use-action.js';

/**
 * Options for form enhancement
 */
export interface FormEnhancementOptions {
  /** Disable native form submission */
  preventNative?: boolean;
  /** Reset form on success */
  resetOnSuccess?: boolean;
  /** Show loading indicator */
  showLoading?: boolean;
  /** Loading class name */
  loadingClass?: string;
  /** Error class name */
  errorClass?: string;
  /** Success class name */
  successClass?: string;
}

/**
 * Enhance a form with JavaScript-powered submission
 */
export function enhanceForm(
  form: HTMLFormElement,
  actionHelper: UseActionResult,
  options: FormEnhancementOptions = {}
): () => void {
  const {
    preventNative = true,
    resetOnSuccess = false,
    showLoading = true,
    loadingClass = 'plank-form-loading',
    errorClass = 'plank-form-error',
    successClass = 'plank-form-success',
  } = options;

  /**
   * Handle form submission
   */
  const handleSubmit = async (event: Event): Promise<void> => {
    if (preventNative) {
      event.preventDefault();
    }

    const formData = new FormData(form);
    const submitButtons = getSubmitButtons(form);

    setFormLoading(form, submitButtons, showLoading, loadingClass, errorClass, successClass);

    try {
      const result = await actionHelper.execute(formData);
      handleFormResult(form, result, {
        showLoading,
        loadingClass,
        errorClass,
        successClass,
        resetOnSuccess,
      });
    } finally {
      finishFormSubmission(form, submitButtons, showLoading, loadingClass);
    }
  };

  // Attach event listener
  form.addEventListener('submit', handleSubmit);

  // Return cleanup function
  return () => {
    form.removeEventListener('submit', handleSubmit);
  };
}

/**
 * Get submit buttons from form
 */
function getSubmitButtons(form: HTMLFormElement): HTMLButtonElement[] {
  return Array.from(
    form.querySelectorAll<HTMLButtonElement>('button[type="submit"], input[type="submit"]')
  );
}

/**
 * Set form to loading state
 */
function setFormLoading(
  form: HTMLFormElement,
  submitButtons: HTMLButtonElement[],
  showLoading: boolean,
  loadingClass: string,
  errorClass: string,
  successClass: string
): void {
  if (showLoading) {
    form.classList.add(loadingClass);
    form.classList.remove(errorClass, successClass);
  }

  for (const button of submitButtons) {
    button.disabled = true;
  }
}

/**
 * Handle form result (success or error)
 */
function handleFormResult(
  form: HTMLFormElement,
  result: { success: boolean; error?: string; errors?: Record<string, string> },
  options: {
    showLoading: boolean;
    loadingClass: string;
    errorClass: string;
    successClass: string;
    resetOnSuccess: boolean;
  }
): void {
  if (result.success) {
    handleFormSuccess(form, options);
  } else {
    handleFormError(form, result, options);
  }
}

/**
 * Handle successful form submission
 */
function handleFormSuccess(
  form: HTMLFormElement,
  options: {
    showLoading: boolean;
    loadingClass: string;
    errorClass: string;
    successClass: string;
    resetOnSuccess: boolean;
  }
): void {
  if (options.showLoading) {
    form.classList.remove(options.loadingClass, options.errorClass);
    form.classList.add(options.successClass);
  }

  if (options.resetOnSuccess) {
    form.reset();
  }

  clearFieldErrors(form);
}

/**
 * Handle form submission error
 */
function handleFormError(
  form: HTMLFormElement,
  result: { error?: string; errors?: Record<string, string> },
  options: { showLoading: boolean; loadingClass: string; errorClass: string; successClass: string }
): void {
  if (options.showLoading) {
    form.classList.remove(options.loadingClass, options.successClass);
    form.classList.add(options.errorClass);
  }

  if (result.errors) {
    displayFieldErrors(form, result.errors);
  }

  if (result.error) {
    displayGeneralError(form, result.error);
  }
}

/**
 * Finish form submission (cleanup)
 */
function finishFormSubmission(
  form: HTMLFormElement,
  submitButtons: HTMLButtonElement[],
  showLoading: boolean,
  loadingClass: string
): void {
  for (const button of submitButtons) {
    button.disabled = false;
  }

  if (showLoading) {
    form.classList.remove(loadingClass);
  }
}

/**
 * Display field-level validation errors
 */
function displayFieldErrors(form: HTMLFormElement, errors: Record<string, string>): void {
  // Clear existing errors first
  clearFieldErrors(form);

  for (const [fieldName, errorMessage] of Object.entries(errors)) {
    const field = form.elements.namedItem(fieldName) as HTMLInputElement | null;

    if (field) {
      // Add error class to field
      field.classList.add('plank-field-error');
      field.setAttribute('aria-invalid', 'true');

      // Create or update error message element
      const errorId = `${fieldName}-error`;
      let errorElement = document.getElementById(errorId);

      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = errorId;
        errorElement.className = 'plank-error-message';
        errorElement.setAttribute('role', 'alert');

        // Insert after field
        field.parentElement?.insertBefore(errorElement, field.nextSibling);
      }

      errorElement.textContent = errorMessage;
      field.setAttribute('aria-describedby', errorId);
    }
  }
}

/**
 * Clear all field-level errors
 */
function clearFieldErrors(form: HTMLFormElement): void {
  // Remove error classes from fields
  const errorFields = form.querySelectorAll('.plank-field-error');
  for (const field of errorFields) {
    field.classList.remove('plank-field-error');
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
  }

  // Remove error message elements
  const errorMessages = form.querySelectorAll('.plank-error-message');
  for (const message of errorMessages) {
    message.remove();
  }

  // Clear general error
  const generalError = form.querySelector('.plank-general-error');
  if (generalError) {
    generalError.remove();
  }
}

/**
 * Display general error message
 */
function displayGeneralError(form: HTMLFormElement, error: string): void {
  // Check if general error element exists
  let errorElement = form.querySelector<HTMLDivElement>('.plank-general-error');

  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'plank-general-error';
    errorElement.setAttribute('role', 'alert');

    // Insert at top of form
    form.insertBefore(errorElement, form.firstChild);
  }

  errorElement.textContent = error;
}

/**
 * Auto-enhance all forms with data-action attribute
 */
export function autoEnhanceForms(
  actions: Map<string, UseActionResult>,
  options: FormEnhancementOptions = {}
): () => void {
  const cleanupFunctions: Array<() => void> = [];

  // Find all forms with data-action
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-action-id]');

  for (const form of forms) {
    const actionId = form.dataset.actionId;

    if (actionId) {
      const actionHelper = actions.get(actionId);

      if (actionHelper) {
        const cleanup = enhanceForm(form, actionHelper, options);
        cleanupFunctions.push(cleanup);
      }
    }
  }

  // Return combined cleanup function
  return () => {
    for (const cleanup of cleanupFunctions) {
      cleanup();
    }
  };
}

/**
 * Create optimistic list item
 */
export function createOptimisticItem<T extends { id: string }>(list: T[], item: T): T[] {
  return [...list, { ...item, id: `optimistic-${Date.now()}` }];
}

/**
 * Remove optimistic items from list
 */
export function removeOptimisticItems<T extends { id: string }>(list: T[]): T[] {
  return list.filter((item) => !item.id.startsWith('optimistic-'));
}

/**
 * Update item in list
 */
export function updateItemInList<T extends { id: string }>(
  list: T[],
  id: string,
  updates: Partial<T>
): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...updates } : item));
}

/**
 * Remove item from list
 */
export function removeItemFromList<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}
