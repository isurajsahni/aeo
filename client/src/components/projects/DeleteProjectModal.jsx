import { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Alert } from '../ui/States.jsx';

export function DeleteProjectModal({ project, open, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  return (
    <Modal open={open} onClose={deleting ? () => {} : onClose} title="Delete project?" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          <strong className="font-semibold text-slate-900">{project?.name}</strong> and all of its audit history will be
          permanently deleted. This can’t be undone.
        </p>
        <Alert>{error}</Alert>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete project
          </Button>
        </div>
      </div>
    </Modal>
  );
}
