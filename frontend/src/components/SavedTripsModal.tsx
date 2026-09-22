import { useEffect, useState } from "react";
import { ArrowRight, Calendar, Check, ExternalLink, MapPin, Trash2, X } from "lucide-react";

interface SavedTrip {
  _id: string;
  request: {
    currentLocation: string;
    pickupLocation: string;
    dropoffLocation: string;
    cycleUsedHours: number;
  };
  plan: any;
  createdAt: string;
}

interface SavedTripsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onSelectTrip: (trip: SavedTrip) => void;
}

import { API_BASE } from "../config";

export function SavedTripsModal({
  isOpen,
  onClose,
  token,
  onSelectTrip,
}: SavedTripsModalProps) {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletedId, setDeletedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && token) {
      loadTrips();
    }
  }, [isOpen, token]);

  async function loadTrips() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/plans/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Unable to fetch saved trips from MongoDB.");
      }
      const data = await res.json();
      setTrips(data.trips || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading trips");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(tripId: string) {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/plans/${tripId}/delete/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to delete trip.");
      }
      setTrips((prev) => prev.filter((t) => t._id !== tripId));
      setDeletedId(tripId);
      setTimeout(() => setDeletedId(null), 2500);
    } catch (err) {
      alert("Error deleting trip: " + (err instanceof Error ? err.message : ""));
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Your Saved Trips</h3>
            <p className="modal-subtitle">Directly stored and synced with MongoDB Atlas.</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {loading && <div className="trips-loading">Loading saved routes from MongoDB Atlas...</div>}
        {error && <div className="form-error">{error}</div>}

        {!loading && trips.length === 0 && (
          <div className="no-trips-state">
            <MapPin size={36} color="#94a3b8" />
            <p>You have no saved trips yet.</p>
            <small>Plan a route and click "Save Trip to Atlas" to store it here.</small>
          </div>
        )}

        <div className="trips-list">
          {trips.map((t) => (
            <div key={t._id} className="saved-trip-item">
              <div className="saved-trip-info">
                <div className="trip-locations">
                  <span className="loc-label">From: <strong>{t.request.currentLocation}</strong></span>
                  <span className="loc-arrow">&rarr;</span>
                  <span className="loc-label">Pickup: <strong>{t.request.pickupLocation}</strong></span>
                  <span className="loc-arrow">&rarr;</span>
                  <span className="loc-label">Dropoff: <strong>{t.request.dropoffLocation}</strong></span>
                </div>
                <div className="trip-meta-row">
                  <span>
                    <Calendar size={13} />
                    {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>Cycle Used: {t.request.cycleUsedHours}h</span>
                  {t.plan?.route && (
                    <span>Distance: {t.plan.route.distanceMiles} mi ({t.plan.route.durationHours} hrs)</span>
                  )}
                </div>
              </div>

              <div className="trip-actions">
                <button
                  type="button"
                  className="trip-btn-load"
                  onClick={() => {
                    onSelectTrip(t);
                    onClose();
                  }}
                  title="Load this trip"
                >
                  <span>Open</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  className="trip-btn-delete"
                  onClick={() => handleDelete(t._id)}
                  title="Delete from MongoDB"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
