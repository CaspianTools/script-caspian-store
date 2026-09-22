'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FirestoreQuestion, FirestoreReview, ModerationStatus } from '../types';
import {
  deleteReview,
  listAllReviews,
  setReviewStatus,
} from '../services/review-service';
import {
  answerQuestion,
  deleteQuestion,
  listAllQuestions,
  setQuestionStatus,
} from '../services/question-service';
import { getProductsByIds } from '../services/product-service';
import { useAuth } from '../context/auth-context';
import { useCaspianFirebase, useCaspianLink } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { Badge, Skeleton } from '../ui/misc';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { Select } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { Dialog } from '../ui/dialog';
import { Label, Textarea } from '../ui/input';
import { StarIcon } from '../components/star-icon';
import { useToast } from '../ui/toast';

type StatusFilter = 'all' | ModerationStatus;

const FILTER_OPTIONS: StatusFilter[] = ['all', 'pending', 'approved', 'rejected'];

const STATUS_VARIANT: Record<ModerationStatus, 'default' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
};

function fmtDate(ts: FirestoreReview['createdAt']) {
  return ts?.toDate ? ts.toDate().toLocaleDateString() : '—';
}

export function AdminReviewsModeration({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const Link = useCaspianLink();

  const [reviews, setReviews] = useState<FirestoreReview[]>([]);
  const [questions, setQuestions] = useState<FirestoreQuestion[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<
    { kind: 'review'; item: FirestoreReview } | { kind: 'question'; item: FirestoreQuestion } | null
  >(null);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<StatusFilter>('pending');
  const [questionFilter, setQuestionFilter] = useState<StatusFilter>('pending');
  const [busy, setBusy] = useState<string | null>(null);

  const [answerTarget, setAnswerTarget] = useState<FirestoreQuestion | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerSaving, setAnswerSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [r, q] = await Promise.all([listAllReviews(db), listAllQuestions(db)]);
        if (!alive) return;
        setReviews(r);
        setQuestions(q);
        // Resolve product names for the Product column; a miss (deleted
        // product) falls back to the raw id in the table.
        const ids = Array.from(new Set([...r, ...q].map((x) => x.productId).filter(Boolean)));
        if (ids.length > 0) {
          try {
            const products = await getProductsByIds(db, ids);
            if (!alive) return;
            const names: Record<string, string> = {};
            for (const p of products) names[p.id] = p.name;
            setProductNames(names);
          } catch (error) {
            console.error('[caspian-store] Product lookup failed:', error);
          }
        }
      } catch (error) {
        console.error('[caspian-store] Failed to load reviews / questions:', error);
        if (alive) toast({ title: t('admin.common.loadFailed'), variant: 'destructive' });
      } finally {
        if (alive) {
          setLoadingReviews(false);
          setLoadingQuestions(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const productCell = (productId: string) => (
    <Link
      href={`/admin/products/${productId}/edit`}
      style={{ color: 'var(--caspian-primary, #111)', textDecoration: 'none' }}
    >
      {productNames[productId] ?? productId}
    </Link>
  );

  const filteredReviews = useMemo(
    () =>
      reviewFilter === 'all' ? reviews : reviews.filter((r) => r.status === reviewFilter),
    [reviews, reviewFilter],
  );
  const filteredQuestions = useMemo(
    () =>
      questionFilter === 'all' ? questions : questions.filter((q) => q.status === questionFilter),
    [questions, questionFilter],
  );

  const handleReviewStatus = async (review: FirestoreReview, status: ModerationStatus) => {
    setBusy(review.id);
    try {
      await setReviewStatus(db, review.id, status);
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, status } : r)));
      toast({ title: `Review ${status}` });
    } catch (error) {
      console.error('[caspian-store] Review update failed:', error);
      toast({ title: 'Action failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteReview = async (review: FirestoreReview) => {
    setBusy(review.id);
    try {
      await deleteReview(db, review.id);
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      setPendingDelete(null);
      toast({ title: 'Review deleted' });
    } catch (error) {
      console.error('[caspian-store] Review delete failed:', error);
      toast({ title: t('admin.common.deleteFailed'), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleQuestionStatus = async (question: FirestoreQuestion, status: ModerationStatus) => {
    setBusy(question.id);
    try {
      await setQuestionStatus(db, question.id, status);
      setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, status } : q)));
      toast({ title: `Question ${status}` });
    } catch (error) {
      console.error('[caspian-store] Question update failed:', error);
      toast({ title: 'Action failed', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteQuestion = async (question: FirestoreQuestion) => {
    setBusy(question.id);
    try {
      await deleteQuestion(db, question.id);
      setQuestions((prev) => prev.filter((q) => q.id !== question.id));
      setPendingDelete(null);
      toast({ title: 'Question deleted' });
    } catch (error) {
      console.error('[caspian-store] Question delete failed:', error);
      toast({ title: t('admin.common.deleteFailed'), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const openAnswer = (question: FirestoreQuestion) => {
    setAnswerTarget(question);
    setAnswerText(question.answer ?? '');
  };

  const handleSaveAnswer = async () => {
    if (!answerTarget || !userProfile) return;
    if (!answerText.trim()) {
      toast({ title: 'Answer cannot be empty', variant: 'destructive' });
      return;
    }
    setAnswerSaving(true);
    try {
      await answerQuestion(db, answerTarget.id, answerText, userProfile.uid);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === answerTarget.id
            ? { ...q, answer: answerText.trim(), answeredByUid: userProfile.uid }
            : q,
        ),
      );
      toast({ title: 'Answer saved' });
      setAnswerTarget(null);
      setAnswerText('');
    } catch (error) {
      console.error('[caspian-store] Answer save failed:', error);
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setAnswerSaving(false);
    }
  };

  return (
    <div className={className}>
      <header className="caspian-admin-page-head" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Reviews &amp; Questions</h1>
        <p style={{ color: '#666', marginTop: 4 }}>
          Moderate customer reviews and Q&amp;A.
        </p>
      </header>

      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews">
          <FilterRow
            value={reviewFilter}
            onChange={setReviewFilter}
          />
          {loadingReviews ? (
            <Skeleton style={{ height: 80 }} />
          ) : filteredReviews.length === 0 ? (
            <Empty text="No reviews match this filter." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Author</TH>
                  <TH>Rating</TH>
                  <TH>Review</TH>
                  <TH>Product</TH>
                  <TH>Date</TH>
                  <TH>Status</TH>
                  <TH style={{ textAlign: 'right' }}>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filteredReviews.map((review) => {
                  const isBusy = busy === review.id;
                  return (
                    <TR key={review.id}>
                      <TD style={{ fontWeight: 500 }}>{review.author}</TD>
                      <TD>
                        <div style={{ display: 'inline-flex', gap: 2 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <StarIcon
                              key={i}
                              width={12}
                              height={12}
                              fill={i < review.rating ? '#f59e0b' : 'none'}
                              stroke={i < review.rating ? '#f59e0b' : 'rgba(0,0,0,0.3)'}
                            />
                          ))}
                        </div>
                      </TD>
                      <TD style={{ maxWidth: 260 }}>
                        <p
                          style={{
                            margin: 0,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {review.text}
                        </p>
                      </TD>
                      <TD style={{ fontSize: 13 }}>{productCell(review.productId)}</TD>
                      <TD style={{ fontSize: 12, color: '#888' }}>{fmtDate(review.createdAt)}</TD>
                      <TD>
                        <Badge variant={STATUS_VARIANT[review.status]}>{review.status}</Badge>
                      </TD>
                      <TD data-label="" style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          {review.status !== 'approved' && (
                            <Button size="sm" disabled={isBusy} onClick={() => handleReviewStatus(review, 'approved')}>
                              Approve
                            </Button>
                          )}
                          {review.status !== 'rejected' && (
                            <Button variant="outline" size="sm" disabled={isBusy} onClick={() => handleReviewStatus(review, 'rejected')}>
                              Reject
                            </Button>
                          )}
                          <Button variant="destructive" size="sm" disabled={isBusy} onClick={() => setPendingDelete({ kind: 'review', item: review })}>
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="questions">
          <FilterRow
            value={questionFilter}
            onChange={setQuestionFilter}
          />
          {loadingQuestions ? (
            <Skeleton style={{ height: 80 }} />
          ) : filteredQuestions.length === 0 ? (
            <Empty text="No questions match this filter." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Author</TH>
                  <TH>Question</TH>
                  <TH>Answer</TH>
                  <TH>Product</TH>
                  <TH>Date</TH>
                  <TH>Status</TH>
                  <TH style={{ textAlign: 'right' }}>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filteredQuestions.map((question) => {
                  const isBusy = busy === question.id;
                  return (
                    <TR key={question.id}>
                      <TD style={{ fontWeight: 500 }}>{question.author}</TD>
                      <TD style={{ maxWidth: 260 }}>
                        <p style={{ margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {question.text}
                        </p>
                      </TD>
                      <TD style={{ maxWidth: 240, color: '#666' }}>
                        {question.answer ? (
                          <p style={{ margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {question.answer}
                          </p>
                        ) : (
                          <span style={{ fontStyle: 'italic', color: '#aaa' }}>—</span>
                        )}
                      </TD>
                      <TD style={{ fontSize: 13 }}>{productCell(question.productId)}</TD>
                      <TD style={{ fontSize: 12, color: '#888' }}>{fmtDate(question.createdAt)}</TD>
                      <TD>
                        <Badge variant={STATUS_VARIANT[question.status]}>{question.status}</Badge>
                      </TD>
                      <TD data-label="" style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <Button variant="outline" size="sm" disabled={isBusy} onClick={() => openAnswer(question)}>
                            Answer
                          </Button>
                          {question.status !== 'approved' && (
                            <Button size="sm" disabled={isBusy} onClick={() => handleQuestionStatus(question, 'approved')}>
                              Approve
                            </Button>
                          )}
                          {question.status !== 'rejected' && (
                            <Button variant="outline" size="sm" disabled={isBusy} onClick={() => handleQuestionStatus(question, 'rejected')}>
                              Reject
                            </Button>
                          )}
                          <Button variant="destructive" size="sm" disabled={isBusy} onClick={() => setPendingDelete({ kind: 'question', item: question })}>
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!answerTarget}
        onOpenChange={(o) => {
          if (!o) {
            setAnswerTarget(null);
            setAnswerText('');
          }
        }}
        title="Answer question"
        description="Your answer will appear below the question on the product page."
        footer={
          <>
            <Button variant="outline" disabled={answerSaving} onClick={() => setAnswerTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAnswer} loading={answerSaving}>
              Save answer
            </Button>
          </>
        }
      >
        {answerTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fafafa', padding: 10, borderRadius: 6, fontSize: 14 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{answerTarget.author} asked:</p>
              <p style={{ margin: '4px 0 0', color: '#555' }}>{answerTarget.text}</p>
            </div>
            <div>
              <Label htmlFor="admin-answer">Your answer</Label>
              <Textarea
                id="admin-answer"
                rows={5}
                maxLength={2000}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title={
          pendingDelete?.kind === 'question'
            ? t('admin.reviews.deleteQuestionTitle')
            : t('admin.reviews.deleteReviewTitle')
        }
        description={t('admin.confirm.deleteBody')}
        confirmLabel={t('common.delete')}
        destructive
        loading={pendingDelete !== null && busy === pendingDelete.item.id}
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.kind === 'review') void handleDeleteReview(pendingDelete.item);
          else void handleDeleteQuestion(pendingDelete.item);
        }}
      />
    </div>
  );
}

function FilterRow({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <div style={{ margin: '12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
      <Label style={{ margin: 0, fontWeight: 500, color: '#666' }}>Filter:</Label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as StatusFilter)}
        options={FILTER_OPTIONS.map((s) => ({ value: s, label: s }))}
      />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: '#888', padding: 32, textAlign: 'center' }}>{text}</p>;
}
