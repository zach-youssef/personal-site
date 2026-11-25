import React from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import { Article } from './ProjectWriteup';

// "2024-09" as "September 2024" and "2024-09-25" as "September 25, 2024", in UTC so that the
// viewer's time zone can't move it into the previous month or day
export function formatArticleDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        ...(day ? { day: 'numeric' } : {}),
    }).format(new Date(Date.UTC(year, month - 1, day || 1)));
}

// The articles about a project, a card each: the whole card links to the article (in the same tab,
// like the site's other outward links), with its source, date and a line on what it covers
function ArticleCards({ articles }: { articles: Article[] }) {
    return (
        <Row className="article-cards">
            {articles.map((article, index) => (
                <Col key={`${index}-${article.url}`} md={6} lg={4}>
                    <Card className="article-card h-100 mb-4">
                        <Card.Body>
                            <Card.Title>
                                <a href={article.url} className="stretched-link">{article.title}</a>
                            </Card.Title>
                            <Card.Subtitle className="my-2 text-muted">
                                {article.date
                                    ? `${article.source} · ${formatArticleDate(article.date)}`
                                    : article.source}
                            </Card.Subtitle>
                            <Card.Text>{article.note}</Card.Text>
                        </Card.Body>
                    </Card>
                </Col>
            ))}
        </Row>
    );
}

export default ArticleCards;
